import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, useCursor, SoftShadows, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Plot, LandState, CropType, Tool, Animal, AnimalType, Structure, StructureType, UpgradeType } from '../../types';
import { CROP_DATA, PLOT_SIZE, COLORS, NPC_DATA } from '../../constants';
import { villageAudio } from '../../services/audioService';
import {
  Point2D,
  findPathAroundStructures,
  resolveObstacleCollision,
  getAllObstacles,
  isPointBlocked,
  findNearestWalkablePoint
} from '../../services/pathfindingService';

function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, alpha);
}

interface GameSceneProps {
  gameState: GameState;
  onPlotClick: (plotId: number) => void;
  onAnimalClick: (animalId: string) => void;
  onNPCClick: (npcId: number) => void;
  onPlaneClick: (point: THREE.Vector3) => void;
  onChulhaClick: () => void;
  onTempleClick: () => void;
  onWellClick: () => void;
  onShopClick: () => void;
  onTalabClick?: () => void;
  onChaiClick?: () => void;
  onTempoClick?: () => void;
  onSleepClick?: () => void;
  onOpenRules?: () => void;
}

// ==========================================
// 1. WEATHER & LIGHTING SYSTEMS
// ==========================================

const Rain = () => {
  const count = 1200;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 80,
        y: Math.random() * 25,
        z: (Math.random() - 0.5) * 80,
        speed: 0.35 + Math.random() * 0.4
      });
    }
    return temp;
  }, []);

  useFrame(() => {
    if (!mesh.current) return;
    particles.forEach((particle, i) => {
      particle.y -= particle.speed;
      if (particle.y < 0) {
        particle.y = 25;
        particle.x = (Math.random() - 0.5) * 80;
        particle.z = (Math.random() - 0.5) * 80;
      }
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.scale.set(0.02, 1.1, 0.02);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
      <meshBasicMaterial color="#b0d4ff" transparent opacity={0.42} />
    </instancedMesh>
  );
};

// ==========================================
// 2. HIGH-CRAFT ANATOMICAL INDIAN CHARACTER
// ==========================================

interface HumanProps {
  position: { x: number; z: number };
  rotation?: number;
  isPlayer?: boolean;
  selectedTool?: Tool;
  isNight?: boolean;
  skinColor?: string;
  kurtaColor?: string;
  dhotiColor?: string;
  turbanColor?: string;
  gamchhaColor?: string;
  hasMustache?: boolean;
  mustacheColor?: string;
  hasBeard?: boolean;
  hasSpectacles?: boolean;
  hasLathi?: boolean;
  hasLedger?: boolean;
  hasSari?: boolean;
  hasCap?: boolean;
  hasTilak?: boolean;
  scale?: number;
  nameBadge?: string;
  roleBadge?: string;
  npcId?: number;
  structures?: Structure[];
  upgrades?: UpgradeType[];
  patrolPoints?: Point2D[];
  onClick?: () => void;
}

const RealisticHuman: React.FC<HumanProps> = ({
  position,
  rotation = 0,
  isPlayer = false,
  selectedTool = Tool.HAND,
  isNight = false,
  skinColor = COLORS.SKIN,
  kurtaColor = '#ffffff',
  dhotiColor = '#f5f5f5',
  turbanColor = COLORS.TURBAN,
  gamchhaColor = '#d32f2f',
  hasMustache = true,
  mustacheColor = '#1f1f1f',
  hasBeard = false,
  hasSpectacles = false,
  hasLathi = false,
  hasLedger = false,
  hasSari = false,
  hasCap = false,
  hasTilak = true,
  scale = 1,
  nameBadge,
  roleBadge,
  npcId = 0,
  structures = [],
  upgrades = [],
  patrolPoints = [],
  onClick
}) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered && !isPlayer, 'pointer', 'auto');

  const group = useRef<THREE.Group>(null);
  const bodyRoot = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftForearm = useRef<THREE.Group>(null);
  const rightForearm = useRef<THREE.Group>(null);
  const leftEyelid = useRef<THREE.Mesh>(null);
  const rightEyelid = useRef<THREE.Mesh>(null);

  // Pathfinding state for both Player & Villager NPCs
  const initialMountPos = useRef<[number, number, number]>([position.x, 0, position.z]);
  const pathRef = useRef<Point2D[]>([]);
  const lastTargetRef = useRef<Point2D>({ x: position.x, z: position.z });
  const lastStructCountRef = useRef<number>(structures.length);
  const patrolIndexRef = useRef<number>(0);
  const nextPatrolTimeRef = useRef<number>(4 + (npcId % 5) * 2.5);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const safeDelta = Math.min(delta, 0.1);

    // Natural eye blinking every few seconds
    const blinkWave = Math.sin(t * 1.7 + npcId * 2.3);
    const isBlinking = blinkWave > 0.96;
    if (leftEyelid.current && rightEyelid.current) {
      const targetScaleY = isBlinking ? 1 : 0.08;
      leftEyelid.current.scale.y = THREE.MathUtils.lerp(leftEyelid.current.scale.y, targetScaleY, safeDelta * 24);
      rightEyelid.current.scale.y = THREE.MathUtils.lerp(rightEyelid.current.scale.y, targetScaleY, safeDelta * 24);
    }

    if (group.current) {
      const currPos = { x: group.current.position.x, z: group.current.position.z };
      const structChanged = structures.length !== lastStructCountRef.current;
      if (structChanged) {
        lastStructCountRef.current = structures.length;
      }

      if (isPlayer) {
        const targetMovedDist = Math.hypot(
          position.x - lastTargetRef.current.x,
          position.z - lastTargetRef.current.z
        );

        if (targetMovedDist > 0.01 || structChanged) {
          lastTargetRef.current = { x: position.x, z: position.z };
          // If it's a click-to-move jump (> 0.65 units) or structures changed, compute A* path around structures
          if (Math.hypot(position.x - currPos.x, position.z - currPos.z) > 0.65 || structChanged) {
            pathRef.current = findPathAroundStructures(currPos, position, structures, upgrades, 0.42);
          } else {
            pathRef.current = [{ x: position.x, z: position.z }];
          }
        }

        const activeWaypoint = pathRef.current.length > 0 ? pathRef.current[0] : position;
        const dx = activeWaypoint.x - currPos.x;
        const dz = activeWaypoint.z - currPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.18 && pathRef.current.length > 1) {
          pathRef.current.shift();
        }

        const isMoving = dist > 0.05;

        if (isMoving) {
          const stepSpeed = Math.min(dist, safeDelta * 5.2);
          const desired = {
            x: currPos.x + (dx / dist) * stepSpeed,
            z: currPos.z + (dz / dist) * stepSpeed
          };
          const resolved = resolveObstacleCollision(currPos, desired, structures, upgrades, 0.38);
          group.current.position.x = resolved.x;
          group.current.position.z = resolved.z;

          const targetAngle = Math.atan2(dx, dz);
          group.current.rotation.y = lerpAngle(group.current.rotation.y, targetAngle, safeDelta * 12);
          const walkCycle = Math.sin(t * 14);
          const kneeCycle = Math.max(0, Math.cos(t * 14));

          if (leftLeg.current && rightLeg.current) {
            leftLeg.current.rotation.x = walkCycle * 0.65;
            rightLeg.current.rotation.x = -walkCycle * 0.65;
          }
          if (leftKnee.current && rightKnee.current) {
            leftKnee.current.rotation.x = kneeCycle * 0.45;
            rightKnee.current.rotation.x = Math.max(0, -Math.cos(t * 14)) * 0.45;
          }
          if (leftArm.current && rightArm.current) {
            leftArm.current.rotation.x = -walkCycle * 0.55;
            rightArm.current.rotation.x = walkCycle * 0.55;
          }
          if (leftForearm.current && rightForearm.current) {
            leftForearm.current.rotation.x = -0.35 - Math.abs(walkCycle) * 0.2;
            rightForearm.current.rotation.x = -0.35 - Math.abs(walkCycle) * 0.2;
          }
          if (bodyRoot.current) {
            bodyRoot.current.position.y = Math.abs(walkCycle) * 0.055;
            bodyRoot.current.rotation.z = walkCycle * 0.03;
          }
          if (headGroup.current) {
            headGroup.current.rotation.y = Math.sin(t * 7) * 0.05;
          }
        } else {
          group.current.rotation.y = lerpAngle(group.current.rotation.y, rotation, safeDelta * 6);
          if (leftLeg.current && rightLeg.current) {
            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, safeDelta * 8);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, safeDelta * 8);
          }
          if (leftKnee.current && rightKnee.current) {
            leftKnee.current.rotation.x = THREE.MathUtils.lerp(leftKnee.current.rotation.x, 0, safeDelta * 8);
            rightKnee.current.rotation.x = THREE.MathUtils.lerp(rightKnee.current.rotation.x, 0, safeDelta * 8);
          }
          // Subtle idle breathing & tool holding pose
          if (leftArm.current && rightArm.current) {
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, Math.sin(t * 2) * 0.04, safeDelta * 6);
            const holdingTool = selectedTool !== Tool.HAND;
            rightArm.current.rotation.x = THREE.MathUtils.lerp(
              rightArm.current.rotation.x,
              holdingTool ? -0.35 + Math.sin(t * 2.5) * 0.06 : -Math.sin(t * 2) * 0.04,
              safeDelta * 6
            );
          }
          if (leftForearm.current && rightForearm.current) {
            leftForearm.current.rotation.x = THREE.MathUtils.lerp(leftForearm.current.rotation.x, -0.15, safeDelta * 6);
            rightForearm.current.rotation.x = THREE.MathUtils.lerp(
              rightForearm.current.rotation.x,
              selectedTool !== Tool.HAND ? -0.45 : -0.15,
              safeDelta * 6
            );
          }
          if (bodyRoot.current) {
            bodyRoot.current.position.y = Math.sin(t * 2.2) * 0.015;
            bodyRoot.current.rotation.z = THREE.MathUtils.lerp(bodyRoot.current.rotation.z, 0, safeDelta * 6);
          }
          if (headGroup.current) {
            headGroup.current.rotation.y = Math.sin(t * 1.1) * 0.12;
            headGroup.current.rotation.x = Math.sin(t * 1.6) * 0.04;
          }
        }
      } else {
        // VILLAGER NPC PATHFINDING & PATROL AROUND PLACED STRUCTURES
        const allWalkPoints = [position, ...patrolPoints];

        // If a structure was placed on top of the villager or path needs recalculation
        if (structChanged) {
          const obstacles = getAllObstacles(structures, upgrades);
          if (isPointBlocked(currPos.x, currPos.z, obstacles, 0.42)) {
            const safeSpot = findNearestWalkablePoint(currPos, obstacles, 0.45);
            pathRef.current = [safeSpot];
          } else if (pathRef.current.length > 0) {
            const finalGoal = pathRef.current[pathRef.current.length - 1];
            pathRef.current = findPathAroundStructures(currPos, finalGoal, structures, upgrades, 0.42);
          }
        }

        // Schedule periodic daytime strolls between village landmarks, or return home at night
        if (isNight) {
          if (pathRef.current.length === 0 && Math.hypot(position.x - currPos.x, position.z - currPos.z) > 0.35) {
            pathRef.current = findPathAroundStructures(currPos, position, structures, upgrades, 0.42);
          }
        } else if (allWalkPoints.length > 1 && t > nextPatrolTimeRef.current && pathRef.current.length === 0) {
          patrolIndexRef.current = (patrolIndexRef.current + 1) % allWalkPoints.length;
          const nextGoal = allWalkPoints[patrolIndexRef.current];
          pathRef.current = findPathAroundStructures(currPos, nextGoal, structures, upgrades, 0.42);
          nextPatrolTimeRef.current = t + 12 + (npcId % 4) * 3.5;
        }

        let npcIsWalking = false;
        if (pathRef.current.length > 0) {
          const wp = pathRef.current[0];
          const dx = wp.x - currPos.x;
          const dz = wp.z - currPos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.16) {
            pathRef.current.shift();
          } else {
            npcIsWalking = true;
            const npcSpeed = 1.65; // Calm village stroll speed
            const step = Math.min(dist, safeDelta * npcSpeed);
            const desired = {
              x: currPos.x + (dx / dist) * step,
              z: currPos.z + (dz / dist) * step
            };
            const resolved = resolveObstacleCollision(currPos, desired, structures, upgrades, 0.38);
            group.current.position.x = resolved.x;
            group.current.position.z = resolved.z;

            const moveAngle = Math.atan2(dx, dz);
            group.current.rotation.y = lerpAngle(group.current.rotation.y, moveAngle, safeDelta * 8);
          }
        }

        const phase = npcId * 1.7 + position.x;

        if (npcIsWalking) {
          const walkCycle = Math.sin(t * 9.5 + npcId);
          const kneeCycle = Math.max(0, Math.cos(t * 9.5 + npcId));
          if (leftLeg.current && rightLeg.current) {
            leftLeg.current.rotation.x = walkCycle * 0.5;
            rightLeg.current.rotation.x = -walkCycle * 0.5;
          }
          if (leftKnee.current && rightKnee.current) {
            leftKnee.current.rotation.x = kneeCycle * 0.35;
            rightKnee.current.rotation.x = Math.max(0, -Math.cos(t * 9.5 + npcId)) * 0.35;
          }
          if (leftArm.current && rightArm.current) {
            leftArm.current.rotation.x = -walkCycle * 0.38;
            rightArm.current.rotation.x = hasLathi ? -0.3 + walkCycle * 0.2 : walkCycle * 0.38;
          }
          if (bodyRoot.current) {
            bodyRoot.current.position.y = Math.abs(walkCycle) * 0.038;
          }
        } else {
          // Smoothly face default orientation when stopped
          group.current.rotation.y = lerpAngle(group.current.rotation.y, rotation, safeDelta * 4);
          if (leftLeg.current && rightLeg.current) {
            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, safeDelta * 6);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, safeDelta * 6);
          }
          if (leftKnee.current && rightKnee.current) {
            leftKnee.current.rotation.x = THREE.MathUtils.lerp(leftKnee.current.rotation.x, 0, safeDelta * 6);
            rightKnee.current.rotation.x = THREE.MathUtils.lerp(rightKnee.current.rotation.x, 0, safeDelta * 6);
          }
          // Expressive Role-Based Idle Animations for Village NPCs
          if (bodyRoot.current) {
            bodyRoot.current.position.y = Math.sin(t * 2 + phase) * 0.018;
          }
          if (headGroup.current) {
            headGroup.current.rotation.y = Math.sin(t * 0.9 + phase) * 0.22;
            headGroup.current.rotation.x = Math.sin(t * 1.5 + phase) * 0.06;
          }
          if (rightArm.current && rightForearm.current) {
            if (hasLathi) {
              // Sarpanch holding his wooden lathi firmly
              rightArm.current.rotation.x = -0.35 + Math.sin(t * 1.5 + phase) * 0.04;
              rightForearm.current.rotation.x = -0.45;
            } else if (hasLedger) {
              // Lala Ji inspecting his Bahi-Khata ledger
              rightArm.current.rotation.x = -0.45;
              rightForearm.current.rotation.x = -0.6 + Math.sin(t * 2.2) * 0.08;
            } else if (npcId === 3) {
              // Pandit Ji giving gentle Aashirwad blessing gesture
              rightArm.current.rotation.x = -0.4 + Math.sin(t * 1.8) * 0.12;
              rightForearm.current.rotation.x = -0.7;
            } else if (npcId === 7) {
              // Chhotu waving cheerfully
              rightArm.current.rotation.z = -0.35 + Math.sin(t * 5) * 0.18;
              rightForearm.current.rotation.x = -0.5;
            } else {
              rightArm.current.rotation.x = Math.sin(t * 1.6 + phase) * 0.08;
              rightForearm.current.rotation.x = -0.25 + Math.sin(t * 2 + phase) * 0.06;
            }
          }
          if (leftArm.current && leftForearm.current) {
            leftArm.current.rotation.x = -Math.sin(t * 1.6 + phase) * 0.07;
            leftForearm.current.rotation.x = -0.2;
          }
        }
      }
    }
  });

  // Render active farming tool in player's right hand
  const renderEquippedTool = () => {
    if (!isPlayer || selectedTool === Tool.HAND) return null;

    if (selectedTool === Tool.HOE) {
      return (
        <group position={[0, -0.05, 0.08]} rotation={[Math.PI / 2.2, 0, 0]}>
          {/* Wooden handle */}
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.02, 0.75, 8]} />
            <meshStandardMaterial color="#6d4c41" roughness={0.8} />
          </mesh>
          {/* Steel Phawra blade */}
          <mesh position={[0, 0.6, 0.08]} rotation={[0.3, 0, 0]} castShadow>
            <boxGeometry args={[0.2, 0.16, 0.025]} />
            <meshStandardMaterial color="#90a4ae" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      );
    }

    if (selectedTool === Tool.SICKLE) {
      return (
        <group position={[0, -0.04, 0.06]} rotation={[1.2, 0, 0]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.024, 0.18, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          {/* Curved Crescent Daranti Blade */}
          <mesh position={[0, 0.22, 0.05]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[0.11, 0.016, 8, 16, Math.PI * 1.1]} />
            <meshStandardMaterial color="#b0bec5" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      );
    }

    if (selectedTool === Tool.WATER_BUCKET) {
      return (
        <group position={[0, -0.18, 0.06]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.085, 0.22, 14]} />
            <meshStandardMaterial color="#78909c" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.1, 12]} />
            <meshStandardMaterial color="#0288d1" roughness={0.1} />
          </mesh>
        </group>
      );
    }

    // Seed Bag (Boriya / Potli)
    return (
      <group position={[0, -0.08, 0.06]}>
        <mesh castShadow>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color="#d7ccc8" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <coneGeometry args={[0.05, 0.06, 8]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      </group>
    );
  };

  return (
    <group
      ref={group}
      position={initialMountPos.current}
      scale={scale}
      onClick={(e) => {
        if (!isPlayer && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      onPointerOver={() => !isPlayer && setHover(true)}
      onPointerOut={() => !isPlayer && setHover(false)}
    >
      {/* Ground Contact Shadow */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 24]} />
        <meshBasicMaterial color="#000000" opacity={0.32} transparent />
      </mesh>

      {/* Player Golden Ground Aura Ring */}
      {isPlayer && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.48, 28]} />
          <meshBasicMaterial color="#ffd54f" opacity={0.55} transparent side={THREE.DoubleSide} />
        </mesh>
      )}

      <group ref={bodyRoot}>
        {/* ===================================================== */}
        {/* 1. ARTICULATED LEGS, KNEES, CALVES & CURVED MOJRI JUTTI */}
        {/* ===================================================== */}
        {!hasSari ? (
          <>
            {/* Left Leg */}
            <group ref={leftLeg} position={[-0.13, 0.52, 0]}>
              {/* Volumetric Draped Dhoti Upper Thigh */}
              <mesh position={[0, -0.13, 0]} castShadow>
                <capsuleGeometry args={[0.085, 0.18, 8, 14]} />
                <meshStandardMaterial color={dhotiColor} roughness={0.82} />
              </mesh>
              {/* Knee & Lower Leg */}
              <group ref={leftKnee} position={[0, -0.26, 0]}>
                <mesh position={[0, -0.1, 0]} castShadow>
                  <capsuleGeometry args={[0.052, 0.16, 8, 12]} />
                  <meshStandardMaterial color={skinColor} roughness={0.68} />
                </mesh>
                {/* Sculpted Traditional Indian Leather Mojri / Jutti with Curled Toe */}
                <group position={[0, -0.23, 0.04]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <capsuleGeometry args={[0.048, 0.11, 8, 12]} />
                    <meshStandardMaterial color="#5d4037" roughness={0.5} />
                  </mesh>
                  {/* Golden Embroidery Trim */}
                  <mesh position={[0, 0.03, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.042, 0.042, 0.07, 10]} />
                    <meshStandardMaterial color="#ffb300" metalness={0.4} roughness={0.4} />
                  </mesh>
                  {/* Curled Jutti Tip (नोकदार जूती) */}
                  <mesh position={[0, 0.03, 0.11]} rotation={[-0.5, 0, 0]}>
                    <coneGeometry args={[0.028, 0.06, 8]} />
                    <meshStandardMaterial color="#4e342e" roughness={0.5} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* Right Leg */}
            <group ref={rightLeg} position={[0.13, 0.52, 0]}>
              <mesh position={[0, -0.13, 0]} castShadow>
                <capsuleGeometry args={[0.085, 0.18, 8, 14]} />
                <meshStandardMaterial color={dhotiColor} roughness={0.82} />
              </mesh>
              <group ref={rightKnee} position={[0, -0.26, 0]}>
                <mesh position={[0, -0.1, 0]} castShadow>
                  <capsuleGeometry args={[0.052, 0.16, 8, 12]} />
                  <meshStandardMaterial color={skinColor} roughness={0.68} />
                </mesh>
                <group position={[0, -0.23, 0.04]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <capsuleGeometry args={[0.048, 0.11, 8, 12]} />
                    <meshStandardMaterial color="#5d4037" roughness={0.5} />
                  </mesh>
                  <mesh position={[0, 0.03, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.042, 0.042, 0.07, 10]} />
                    <meshStandardMaterial color="#ffb300" metalness={0.4} roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0.03, 0.11]} rotation={[-0.5, 0, 0]}>
                    <coneGeometry args={[0.028, 0.06, 8]} />
                    <meshStandardMaterial color="#4e342e" roughness={0.5} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* Central Dhoti Pleated Fold (धोती की चुन्नट) */}
            <mesh position={[0, 0.4, 0.12]} castShadow>
              <capsuleGeometry args={[0.045, 0.24, 6, 10]} />
              <meshStandardMaterial color={dhotiColor} roughness={0.85} />
            </mesh>
          </>
        ) : (
          /* Gracefully Draped Traditional Indian Sari Skirt with Gold Zari Border */
          <group position={[0, 0.36, 0]}>
            <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.19, 0.31, 0.68, 20]} />
              <meshStandardMaterial color={kurtaColor} roughness={0.72} />
            </mesh>
            {/* Golden Zari Kinari Bottom Border */}
            <mesh position={[0, -0.34, 0]}>
              <cylinderGeometry args={[0.305, 0.315, 0.07, 20]} />
              <meshStandardMaterial color="#ffd54f" metalness={0.35} roughness={0.4} />
            </mesh>
            {/* Front Sari Pleat Folds */}
            {[-0.04, 0, 0.04].map((px, i) => (
              <mesh key={`pleat-${i}`} position={[px, -0.05, 0.22]} castShadow>
                <capsuleGeometry args={[0.022, 0.52, 6, 8]} />
                <meshStandardMaterial color={kurtaColor} roughness={0.75} />
              </mesh>
            ))}
          </group>
        )}

        {/* ===================================================== */}
        {/* 2. SCULPTED ANATOMICAL TORSO, SHOULDERS & KURTA/SARI  */}
        {/* ===================================================== */}
        <group position={[0, 0.88, 0]}>
          {/* Sculpted Upper Chest & Tapered Waist */}
          <mesh position={[0, 0.04, 0]} scale={[1.12, 1, 0.82]} castShadow receiveShadow>
            <capsuleGeometry args={[0.19, 0.32, 12, 20]} />
            <meshStandardMaterial color={kurtaColor} roughness={0.72} />
          </mesh>

          {/* Rounded Shoulder Clavicle Bridge */}
          <mesh position={[0, 0.21, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <capsuleGeometry args={[0.085, 0.36, 10, 14]} />
            <meshStandardMaterial color={kurtaColor} roughness={0.72} />
          </mesh>

          {/* Kurta Lower Flared Hem Overhang */}
          {!hasSari && (
            <mesh position={[0, -0.22, 0]} scale={[1.05, 1, 0.85]} castShadow>
              <cylinderGeometry args={[0.19, 0.24, 0.28, 18]} />
              <meshStandardMaterial color={kurtaColor} roughness={0.75} />
            </mesh>
          )}

          {/* Traditional Waist Kamarbandh / Patka Sash */}
          {!hasSari && (
            <mesh position={[0, -0.09, 0]} scale={[1.06, 1, 0.86]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.185, 0.028, 10, 20]} />
              <meshStandardMaterial color={gamchhaColor} roughness={0.8} />
            </mesh>
          )}

          {/* Diagonal Draped Sari Pallu Across Chest & Shoulder (for Women) */}
          {hasSari && (
            <mesh position={[-0.03, 0.08, 0.14]} rotation={[0.15, 0.2, -0.55]} castShadow>
              <capsuleGeometry args={[0.08, 0.38, 8, 12]} />
              <meshStandardMaterial color="#ffb300" roughness={0.65} />
            </mesh>
          )}

          {/* Mandarin Collar & Buttoned Placket */}
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.1, 0.115, 0.06, 14]} />
            <meshStandardMaterial color={kurtaColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.12, 0.16]}>
            <capsuleGeometry args={[0.016, 0.2, 6, 8]} />
            <meshStandardMaterial color="#ffe082" roughness={0.5} />
          </mesh>

          {/* Draped Desi Gamchha / Angavastram Towel on Shoulder */}
          {(isPlayer || npcId === 1 || npcId === 5) && !hasSari && (
            <group position={[-0.17, 0.14, 0.02]} rotation={[0.05, 0, -0.18]}>
              <mesh scale={[0.6, 1, 1.1]} castShadow>
                <capsuleGeometry args={[0.065, 0.38, 8, 12]} />
                <meshStandardMaterial color={gamchhaColor} roughness={0.85} />
              </mesh>
              {/* White Checkered Border Stripe on Gamchha */}
              <mesh position={[0, -0.2, 0]} scale={[0.62, 1, 1.12]}>
                <cylinderGeometry args={[0.066, 0.066, 0.04, 10]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </group>
          )}

          {/* ===================================================== */}
          {/* 3. ARTICULATED 2-SEGMENT ARMS, ELBOWS & HANDS         */}
          {/* ===================================================== */}

          {/* Left Arm */}
          <group ref={leftArm} position={[-0.26, 0.2, 0]}>
            {/* Upper Arm Sleeve */}
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.058, 0.16, 8, 12]} />
              <meshStandardMaterial color={kurtaColor} roughness={0.72} />
            </mesh>
            {/* Elbow & Forearm */}
            <group ref={leftForearm} position={[0, -0.22, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.045, 0.15, 8, 12]} />
                <meshStandardMaterial color={skinColor} roughness={0.65} />
              </mesh>
              {/* Bangles for Women */}
              {hasSari && (
                <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.048, 0.012, 8, 14]} />
                  <meshStandardMaterial color="#d32f2f" metalness={0.3} roughness={0.3} />
                </mesh>
              )}
              {/* Sculpted Hand with Palm & Thumb */}
              <group position={[0, -0.22, 0]}>
                <mesh scale={[0.85, 1.1, 0.65]} castShadow>
                  <sphereGeometry args={[0.048, 10, 10]} />
                  <meshStandardMaterial color={skinColor} roughness={0.65} />
                </mesh>
                {/* Thumb */}
                <mesh position={[0.035, 0.01, 0.025]} rotation={[0.4, 0, -0.4]}>
                  <capsuleGeometry args={[0.014, 0.025, 6, 6]} />
                  <meshStandardMaterial color={skinColor} />
                </mesh>
              </group>
            </group>
          </group>

          {/* Right Arm */}
          <group ref={rightArm} position={[0.26, 0.2, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.058, 0.16, 8, 12]} />
              <meshStandardMaterial color={kurtaColor} roughness={0.72} />
            </mesh>
            <group ref={rightForearm} position={[0, -0.22, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.045, 0.15, 8, 12]} />
                <meshStandardMaterial color={skinColor} roughness={0.65} />
              </mesh>
              {hasSari && (
                <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.048, 0.012, 8, 14]} />
                  <meshStandardMaterial color="#d32f2f" metalness={0.3} roughness={0.3} />
                </mesh>
              )}
              {/* Sculpted Right Hand */}
              <group position={[0, -0.22, 0]}>
                <mesh scale={[0.85, 1.1, 0.65]} castShadow>
                  <sphereGeometry args={[0.048, 10, 10]} />
                  <meshStandardMaterial color={skinColor} roughness={0.65} />
                </mesh>
                <mesh position={[-0.035, 0.01, 0.025]} rotation={[0.4, 0, 0.4]}>
                  <capsuleGeometry args={[0.014, 0.025, 6, 6]} />
                  <meshStandardMaterial color={skinColor} />
                </mesh>

                {/* Player's Active Tool in Hand */}
                {renderEquippedTool()}

                {/* Sarpanch's Bamboo Lathi with Brass Cap */}
                {hasLathi && (
                  <group position={[0.04, 0.12, 0.08]} rotation={[0.35, 0, 0.05]}>
                    <mesh castShadow>
                      <cylinderGeometry args={[0.022, 0.026, 1.4, 10]} />
                      <meshStandardMaterial color="#6d4c41" roughness={0.65} />
                    </mesh>
                    <mesh position={[0, 0.7, 0]}>
                      <cylinderGeometry args={[0.025, 0.025, 0.08, 10]} />
                      <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} />
                    </mesh>
                  </group>
                )}

                {/* Lala Ji's Red Bahi-Khata Ledger with Gold Thread */}
                {hasLedger && (
                  <group position={[0, -0.04, 0.1]} rotation={[0.5, 0.2, -0.2]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.19, 0.26, 0.05]} />
                      <meshStandardMaterial color="#c62828" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0, 0.028]}>
                      <boxGeometry args={[0.15, 0.22, 0.01]} />
                      <meshStandardMaterial color="#fff8e1" />
                    </mesh>
                  </group>
                )}
              </group>
            </group>
          </group>

          {/* ===================================================== */}
          {/* 4. SCULPTED NECK, HEAD, FACIAL FEATURES & PAGDI       */}
          {/* ===================================================== */}
          <mesh position={[0, 0.33, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.08, 8, 12]} />
            <meshStandardMaterial color={skinColor} roughness={0.65} />
          </mesh>

          <group ref={headGroup} position={[0, 0.5, 0]}>
            {/* Sculpted Cranium & Face Contour */}
            <mesh scale={[0.95, 1.08, 0.98]} castShadow>
              <sphereGeometry args={[0.175, 24, 24]} />
              <meshStandardMaterial color={skinColor} roughness={0.62} />
            </mesh>

            {/* Smoothly Blended Cheekbones & Rounded Chin (No Boxy Jaw!) */}
            <mesh position={[0, -0.055, 0.035]} scale={[0.88, 0.75, 0.85]} castShadow>
              <sphereGeometry args={[0.145, 18, 18]} />
              <meshStandardMaterial color={skinColor} roughness={0.62} />
            </mesh>

            {/* 3D Ears on Both Sides with Golden Baliyan Earrings */}
            {[-0.168, 0.168].map((ex, idx) => (
              <group key={`ear-${idx}`} position={[ex, -0.01, 0]}>
                <mesh scale={[0.45, 0.85, 0.6]} rotation={[0, 0, ex < 0 ? 0.15 : -0.15]}>
                  <sphereGeometry args={[0.045, 10, 10]} />
                  <meshStandardMaterial color={skinColor} roughness={0.65} />
                </mesh>
                {/* Golden Hoop Earring (कुंडल / बाली) */}
                <mesh position={[ex < 0 ? -0.01 : 0.01, -0.04, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <torusGeometry args={[0.018, 0.005, 6, 12]} />
                  <meshStandardMaterial color="#ffd700" metalness={0.85} roughness={0.2} />
                </mesh>
              </group>
            ))}

            {/* Sacred Forehead Tilak / Red Bindi */}
            {hasTilak && (
              <group position={[0, 0.075, 0.165]}>
                {hasSari ? (
                  <mesh>
                    <sphereGeometry args={[0.016, 10, 10]} />
                    <meshBasicMaterial color="#d50000" />
                  </mesh>
                ) : (
                  <mesh scale={[0.6, 1.4, 0.4]}>
                    <sphereGeometry args={[0.018, 8, 8]} />
                    <meshBasicMaterial color="#ff3d00" />
                  </mesh>
                )}
              </group>
            )}

            {/* Expressive Blinking Eyes with Brown Iris, Pupil & Catchlight */}
            {[-0.058, 0.058].map((x, idx) => (
              <group key={`eye-${idx}`} position={[x, 0.02, 0.152]}>
                {/* Sclera */}
                <mesh scale={[1.15, 0.9, 0.7]}>
                  <sphereGeometry args={[0.026, 12, 12]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                {/* Warm Dark Brown Iris */}
                <mesh position={[0, 0, 0.014]} scale={[1, 1, 0.5]}>
                  <sphereGeometry args={[0.016, 10, 10]} />
                  <meshBasicMaterial color="#3e2723" />
                </mesh>
                {/* Black Pupil */}
                <mesh position={[0, 0, 0.019]} scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.009, 8, 8]} />
                  <meshBasicMaterial color="#000000" />
                </mesh>
                {/* Sparkle Catchlight */}
                <mesh position={[0.005, 0.005, 0.022]}>
                  <sphereGeometry args={[0.004, 6, 6]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                {/* Animated Blinking Upper Eyelid */}
                <mesh
                  ref={idx === 0 ? leftEyelid : rightEyelid}
                  position={[0, 0.004, 0.002]}
                  scale={[1.2, 0.08, 0.8]}
                >
                  <sphereGeometry args={[0.027, 10, 10]} />
                  <meshStandardMaterial color={skinColor} roughness={0.6} />
                </mesh>
                {/* Expressive Arched Eyebrow */}
                <mesh
                  position={[0, 0.036, 0.008]}
                  rotation={[0, 0, (x < 0 ? 0.12 : -0.12) + Math.PI / 2]}
                >
                  <capsuleGeometry args={[0.008, 0.036, 6, 8]} />
                  <meshStandardMaterial color={mustacheColor} roughness={0.8} />
                </mesh>
              </group>
            ))}

            {/* Sculpted Anatomical Nose Bridge & Tip */}
            <group position={[0, -0.01, 0.172]}>
              <mesh rotation={[-0.25, 0, 0]}>
                <capsuleGeometry args={[0.018, 0.038, 8, 10]} />
                <meshStandardMaterial color={skinColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.022, 0.008]}>
                <sphereGeometry args={[0.022, 10, 10]} />
                <meshStandardMaterial color={skinColor} roughness={0.6} />
              </mesh>
            </group>

            {/* Warm Gentle Smile / Lips */}
            <mesh position={[0, -0.078, 0.152]} rotation={[0.2, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.009, 0.036, 6, 8]} />
              <meshStandardMaterial color="#a15c48" roughness={0.5} />
            </mesh>

            {/* Curled Indian Handlebar Mustache (रोबदार मूँछें) */}
            {hasMustache && (
              <group position={[0, -0.052, 0.165]}>
                {/* Left Mustache Wing */}
                <mesh position={[-0.032, 0, 0]} rotation={[0, 0.15, 0.35 + Math.PI / 2]}>
                  <capsuleGeometry args={[0.013, 0.045, 6, 10]} />
                  <meshStandardMaterial color={mustacheColor} roughness={0.8} />
                </mesh>
                {/* Left Curled Tip */}
                <mesh position={[-0.068, 0.012, -0.005]} rotation={[0, 0, -0.4]}>
                  <coneGeometry args={[0.01, 0.03, 6]} />
                  <meshStandardMaterial color={mustacheColor} />
                </mesh>
                {/* Right Mustache Wing */}
                <mesh position={[0.032, 0, 0]} rotation={[0, -0.15, -0.35 + Math.PI / 2]}>
                  <capsuleGeometry args={[0.013, 0.045, 6, 10]} />
                  <meshStandardMaterial color={mustacheColor} roughness={0.8} />
                </mesh>
                {/* Right Curled Tip */}
                <mesh position={[0.068, 0.012, -0.005]} rotation={[0, 0, 0.4]}>
                  <coneGeometry args={[0.01, 0.03, 6]} />
                  <meshStandardMaterial color={mustacheColor} />
                </mesh>
              </group>
            )}

            {/* Optional Flowing Elder Beard */}
            {hasBeard && (
              <mesh position={[0, -0.11, 0.11]} scale={[0.9, 1.1, 0.7]} castShadow>
                <sphereGeometry args={[0.095, 12, 12]} />
                <meshStandardMaterial color={mustacheColor} roughness={0.9} />
              </mesh>
            )}

            {/* Classic Round Wire-Rim Spectacles (चश्मा) */}
            {hasSpectacles && (
              <group position={[0, 0.02, 0.178]}>
                {[-0.056, 0.056].map((x, i) => (
                  <mesh key={`spec-${i}`} position={[x, 0, 0]}>
                    <torusGeometry args={[0.032, 0.004, 8, 20]} />
                    <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} />
                  </mesh>
                ))}
                <mesh position={[0, 0.005, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.003, 0.003, 0.045, 6]} />
                  <meshStandardMaterial color="#ffd54f" metalness={0.8} />
                </mesh>
              </group>
            )}

            {/* ===================================================== */}
            {/* 5. MULTI-LAYERED INDIAN HEADWEAR (PAGDI / SARI / CAP) */}
            {/* ===================================================== */}
            {!hasSari && !hasCap && (
              <group position={[0, 0.11, -0.01]}>
                {/* Sculpted Hairline under Turban */}
                <mesh position={[0, -0.04, -0.04]}>
                  <sphereGeometry args={[0.165, 14, 14]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
                </mesh>
                {/* Lower Coiled Pagdi Fold */}
                <mesh rotation={[Math.PI / 2 + 0.08, 0.1, 0]} scale={[1.02, 1.08, 0.95]} castShadow>
                  <torusGeometry args={[0.135, 0.068, 14, 28]} />
                  <meshStandardMaterial color={turbanColor} roughness={0.72} />
                </mesh>
                {/* Upper Crossed Pagdi Twist */}
                <mesh position={[0, 0.05, 0.01]} rotation={[Math.PI / 2 - 0.12, -0.18, 0]} scale={[0.98, 1.04, 0.9]} castShadow>
                  <torusGeometry args={[0.125, 0.062, 14, 28]} />
                  <meshStandardMaterial color={turbanColor} roughness={0.72} />
                </mesh>
                {/* Crown Dome of Pagdi */}
                <mesh position={[0, 0.07, -0.01]} scale={[1, 0.85, 1.05]} castShadow>
                  <sphereGeometry args={[0.125, 14, 14]} />
                  <meshStandardMaterial color={turbanColor} roughness={0.75} />
                </mesh>
                {/* Pleated Fan Crest on Top (कलगी / तुर्रा) */}
                {isPlayer && (
                  <mesh position={[0.04, 0.16, 0.08]} rotation={[-0.2, 0, -0.25]} castShadow>
                    <coneGeometry args={[0.06, 0.12, 8]} />
                    <meshStandardMaterial color={turbanColor} roughness={0.7} />
                  </mesh>
                )}
                {/* Flowing Back Tail of Pagdi (पगड़ी का पल्लू) */}
                <mesh position={[0.03, -0.14, -0.17]} rotation={[0.25, 0, 0.1]} castShadow>
                  <capsuleGeometry args={[0.038, 0.22, 8, 10]} />
                  <meshStandardMaterial color={turbanColor} roughness={0.78} />
                </mesh>
              </group>
            )}

            {/* Driver Cap / Boy Hair */}
            {hasCap && (
              <group position={[0, 0.13, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.165, 0.155, 0.1, 18]} />
                  <meshStandardMaterial color="#37474f" roughness={0.6} />
                </mesh>
                <mesh position={[0, -0.03, 0.13]} rotation={[0.2, 0, 0]} scale={[1, 0.2, 0.8]}>
                  <sphereGeometry args={[0.13, 12, 12]} />
                  <meshStandardMaterial color="#1c1c1c" roughness={0.3} />
                </mesh>
              </group>
            )}

            {/* Draped Sari Pallu Veil & Hair Bun (Juda) for Women */}
            {hasSari && (
              <group>
                {/* Traditional Hair Bun at back */}
                <mesh position={[0, 0.01, -0.16]}>
                  <sphereGeometry args={[0.085, 12, 12]} />
                  <meshStandardMaterial color="#212121" roughness={0.85} />
                </mesh>
                {/* Draped Head Pallu */}
                <mesh position={[0, 0.045, -0.03]} scale={[1.06, 1.08, 1.08]} castShadow>
                  <sphereGeometry args={[0.18, 18, 18]} />
                  <meshStandardMaterial color={kurtaColor} roughness={0.75} />
                </mesh>
                {/* Golden Border Along Forehead Veil */}
                <mesh position={[0, 0.07, 0.06]} rotation={[1.15, 0, 0]}>
                  <torusGeometry args={[0.158, 0.016, 8, 20, Math.PI * 1.1]} />
                  <meshStandardMaterial color="#ffd54f" metalness={0.4} roughness={0.4} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>

      {/* Warm Night Lantern Glow for Villagers */}
      {isNight && (
        <pointLight
          position={[0.35, 1.1, 0.35]}
          color="#ffb74d"
          intensity={isPlayer ? 1.8 : 0.9}
          distance={4.5}
        />
      )}

      {/* Interactive Floating Badge (for NPCs) */}
      {!isPlayer && nameBadge && (
        <Float speed={2} rotationIntensity={0} floatIntensity={0.22}>
          <group position={[0, 2.18, 0]}>
            <Text
              fontSize={0.24}
              color={hovered ? '#ffd54f' : '#ffffff'}
              outlineWidth={0.03}
              outlineColor="#000000"
              anchorX="center"
              anchorY="middle"
            >
              {nameBadge}
            </Text>
            {roleBadge && (
              <Text
                position={[0, -0.22, 0]}
                fontSize={0.15}
                color="#ffe082"
                outlineWidth={0.02}
                outlineColor="#000000"
                anchorX="center"
                anchorY="middle"
              >
                {roleBadge}
              </Text>
            )}
          </group>
        </Float>
      )}
    </group>
  );
};

// ==========================================
// 3. REALISTIC FARM ANIMALS WITH UNIQUE IDLE & SLEEPING ANIMATIONS
// ==========================================

interface AnimalComponentProps {
  animal: Animal;
  isNight: boolean;
  structures: Structure[];
  upgrades: UpgradeType[];
  onClick: (id: string) => void;
}

/**
 * Shared per-frame A* waypoint navigation helper for farm animals so Cows, Chickens, and Goats
 * dynamically route around player-placed structures and static village buildings.
 */
function stepAnimalAlongPath(
  group: THREE.Group,
  animal: Animal,
  structures: Structure[],
  upgrades: UpgradeType[],
  waypointsRef: React.MutableRefObject<Point2D[]>,
  lastGoalRef: React.MutableRefObject<Point2D>,
  lastStructCountRef: React.MutableRefObject<number>,
  isSleeping: boolean,
  speed: number,
  clearance: number,
  delta: number
): boolean {
  const safeDelta = Math.min(delta, 0.1);
  const currPos = { x: group.position.x, z: group.position.z };
  const goalChanged =
    Math.hypot(animal.x - lastGoalRef.current.x, animal.z - lastGoalRef.current.z) > 0.05;
  const structChanged = structures.length !== lastStructCountRef.current;

  if (goalChanged || structChanged) {
    lastGoalRef.current = { x: animal.x, z: animal.z };
    lastStructCountRef.current = structures.length;
    waypointsRef.current = findPathAroundStructures(
      currPos,
      { x: animal.x, z: animal.z },
      structures,
      upgrades,
      clearance
    );
  }

  if (isSleeping) {
    group.rotation.y = lerpAngle(group.rotation.y, animal.rotation, safeDelta * 4);
    return false;
  }

  if (waypointsRef.current.length === 0) {
    const dGoal = Math.hypot(animal.x - currPos.x, animal.z - currPos.z);
    if (dGoal > 0.12) {
      waypointsRef.current = [{ x: animal.x, z: animal.z }];
    } else {
      group.rotation.y = lerpAngle(group.rotation.y, animal.rotation, safeDelta * 4);
      return false;
    }
  }

  const wp = waypointsRef.current[0];
  const dx = wp.x - currPos.x;
  const dz = wp.z - currPos.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.14) {
    waypointsRef.current.shift();
    if (waypointsRef.current.length === 0) {
      group.rotation.y = lerpAngle(group.rotation.y, animal.rotation, safeDelta * 4);
      return false;
    }
  }

  const activeWp = waypointsRef.current[0];
  const adx = activeWp.x - currPos.x;
  const adz = activeWp.z - currPos.z;
  const adist = Math.hypot(adx, adz);

  if (adist > 0.03) {
    const step = Math.min(adist, safeDelta * speed);
    const desired = {
      x: currPos.x + (adx / adist) * step,
      z: currPos.z + (adz / adist) * step
    };
    const resolved = resolveObstacleCollision(currPos, desired, structures, upgrades, clearance * 0.9);
    group.position.x = resolved.x;
    group.position.z = resolved.z;

    const moveHeading = Math.atan2(adx, adz);
    group.rotation.y = lerpAngle(group.rotation.y, moveHeading, safeDelta * 7);
    return true;
  }

  return false;
}

// ------------------------------------------
// 3A. DESI GIR COW (गौ माता) - Grazing, Walking & Night Sleeping
// ------------------------------------------
const RealisticCow: React.FC<AnimalComponentProps> = ({ animal, isNight, structures, upgrades, onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  const group = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const neckGroup = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Mesh>(null);
  const leftEarRef = useRef<THREE.Mesh>(null);
  const rightEarRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Group>(null);
  const flLeg = useRef<THREE.Group>(null);
  const frLeg = useRef<THREE.Group>(null);
  const blLeg = useRef<THREE.Group>(null);
  const brLeg = useRef<THREE.Group>(null);
  const bellRef = useRef<THREE.Group>(null);

  const initialMountPos = useRef<[number, number, number]>([animal.x, 0, animal.z]);
  const waypointsRef = useRef<Point2D[]>(animal.path || []);
  const lastGoalRef = useRef<Point2D>({ x: animal.x, z: animal.z });
  const lastStructCountRef = useRef<number>(structures.length);

  const isSleeping = isNight || animal.state === 'sleeping';

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (group.current) {
      const isMoving = stepAnimalAlongPath(
        group.current,
        animal,
        structures,
        upgrades,
        waypointsRef,
        lastGoalRef,
        lastStructCountRef,
        isSleeping,
        1.75,
        0.52,
        delta
      );
      const isGrazing = !isSleeping && !isMoving && (animal.state === 'grazing' || animal.state === 'idle');

      // 1. BODY POSTURE (Standing vs Lying Down Sleeping at Night)
      if (bodyGroup.current) {
        const targetY = isSleeping
          ? 0.42 + Math.sin(t * 1.6) * 0.015
          : isMoving
          ? 0.82 + Math.abs(Math.sin(t * 9)) * 0.04
          : 0.8 + Math.sin(t * 2.2) * 0.012;
        bodyGroup.current.position.y = THREE.MathUtils.lerp(bodyGroup.current.position.y, targetY, delta * 5);

        // Breathing chest expansion when sleeping
        const breathScale = isSleeping ? 1 + Math.sin(t * 1.6) * 0.025 : 1;
        bodyGroup.current.scale.set(breathScale, 1, 1);
      }

      // 2. NECK & HEAD ANIMATION (Grazing Grass vs Sleeping vs Walking)
      if (neckGroup.current && headGroup.current) {
        if (isSleeping) {
          // Rests head peacefully tucked downward and slightly to the side
          neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, 0.48, delta * 4);
          neckGroup.current.rotation.y = THREE.MathUtils.lerp(neckGroup.current.rotation.y, 0.28, delta * 4);
          headGroup.current.rotation.x = THREE.MathUtils.lerp(headGroup.current.rotation.x, 0.15, delta * 4);
          headGroup.current.rotation.z = THREE.MathUtils.lerp(headGroup.current.rotation.z, 0.12, delta * 4);
        } else if (isMoving) {
          // Head raised alertly while walking
          neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, 0.05 + Math.sin(t * 9) * 0.06, delta * 6);
          neckGroup.current.rotation.y = THREE.MathUtils.lerp(neckGroup.current.rotation.y, 0, delta * 6);
          headGroup.current.rotation.x = THREE.MathUtils.lerp(headGroup.current.rotation.x, -0.15, delta * 6);
          headGroup.current.rotation.z = THREE.MathUtils.lerp(headGroup.current.rotation.z, 0, delta * 6);
        } else if (isGrazing) {
          // Grazing cycle: lowers neck to the grass for ~5s, then briefly lifts head to chew cud
          const grazeCycle = Math.sin(t * 0.65 + animal.x);
          const isHeadDown = grazeCycle > -0.35;
          const targetNeckX = isHeadDown ? 0.68 + Math.sin(t * 4.5) * 0.06 : 0.12;
          const targetNeckY = isHeadDown ? Math.sin(t * 1.4) * 0.18 : Math.sin(t * 0.8) * 0.1;

          neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, targetNeckX, delta * 5);
          neckGroup.current.rotation.y = THREE.MathUtils.lerp(neckGroup.current.rotation.y, targetNeckY, delta * 5);
          headGroup.current.rotation.x = THREE.MathUtils.lerp(
            headGroup.current.rotation.x,
            isHeadDown ? 0.12 + Math.sin(t * 6) * 0.05 : -0.1,
            delta * 6
          );
          // Rhythmic side-to-side cud chewing tilt
          headGroup.current.rotation.z = Math.sin(t * 7) * 0.05;
        }
      }

      // 3. JAW CHEWING MOTION (जुगाली करना)
      if (jawRef.current) {
        if (!isSleeping) {
          jawRef.current.position.x = Math.sin(t * 8.5) * 0.025;
          jawRef.current.position.y = -0.1 - Math.abs(Math.sin(t * 8.5)) * 0.015;
        } else {
          jawRef.current.position.x = 0;
          jawRef.current.position.y = -0.1;
        }
      }

      // 4. GIR EARS FLICKING & BELL SWAY
      if (leftEarRef.current && rightEarRef.current) {
        const earFlick = isSleeping ? 0 : Math.sin(t * 5.5) * 0.12;
        leftEarRef.current.rotation.z = 0.55 + earFlick;
        rightEarRef.current.rotation.z = -0.55 - earFlick;
      }
      if (bellRef.current) {
        bellRef.current.rotation.z = isSleeping ? 0 : Math.sin(t * 6) * 0.18;
      }

      // 5. 4 LEGS ARTICULATION (Walking vs Standing vs Tucked Sleeping)
      const legs = [flLeg.current, frLeg.current, blLeg.current, brLeg.current];
      if (legs[0] && legs[1] && legs[2] && legs[3]) {
        if (isSleeping) {
          // Fold legs underneath body
          legs[0].rotation.x = THREE.MathUtils.lerp(legs[0].rotation.x, 1.35, delta * 5);
          legs[1].rotation.x = THREE.MathUtils.lerp(legs[1].rotation.x, 1.35, delta * 5);
          legs[2].rotation.x = THREE.MathUtils.lerp(legs[2].rotation.x, -1.35, delta * 5);
          legs[3].rotation.x = THREE.MathUtils.lerp(legs[3].rotation.x, -1.35, delta * 5);
        } else if (isMoving) {
          const stride = Math.sin(t * 10) * 0.45;
          legs[0].rotation.x = stride;
          legs[1].rotation.x = -stride;
          legs[2].rotation.x = -stride;
          legs[3].rotation.x = stride;
        } else {
          legs.forEach((leg) => {
            if (leg) leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, 0, delta * 6);
          });
        }
      }

      // 6. TAIL SWISHING FLIES
      if (tailRef.current) {
        tailRef.current.rotation.z = isSleeping ? 0.05 : Math.sin(t * 5.5) * 0.28;
      }
    }
  });

  return (
    <group
      ref={group}
      position={initialMountPos.current}
      onClick={(e) => {
        e.stopPropagation();
        villageAudio.playCow();
        onClick(animal.id);
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Ground Contact Shadow */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.45, 1]}>
        <circleGeometry args={[0.78, 24]} />
        <meshBasicMaterial color="#000000" opacity={0.32} transparent />
      </mesh>

      {/* Nibbled Grass Tuft Under Mouth When Grazing */}
      {!isSleeping && (
        <group position={[0, 0.04, 1.05]}>
          {[-0.08, 0, 0.08].map((gx, i) => (
            <mesh key={`graze-tuft-${i}`} position={[gx, 0.06, (i - 1) * 0.05]} rotation={[0.15, i, (i - 1) * 0.2]}>
              <coneGeometry args={[0.035, 0.16, 5]} />
              <meshStandardMaterial color="#43a047" roughness={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* Main Cow Body Root */}
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        {/* Sculpted Barrel Ribcage & Torso */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.42, 0.82, 12, 20]} />
          <meshStandardMaterial color="#f8f6f0" roughness={0.72} />
        </mesh>

        {/* Warm Gir Chestnut Patches */}
        <mesh position={[0.24, 0.1, 0.18]} scale={[0.8, 0.9, 1.2]}>
          <sphereGeometry args={[0.24, 12, 12]} />
          <meshStandardMaterial color="#795548" roughness={0.8} />
        </mesh>
        <mesh position={[-0.25, 0.06, -0.22]} scale={[0.8, 0.9, 1.1]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#6d4c41" roughness={0.8} />
        </mesh>

        {/* Pink Udder Underneath */}
        <mesh position={[0, -0.36, -0.18]} scale={[0.9, 0.75, 1.1]}>
          <sphereGeometry args={[0.17, 10, 10]} />
          <meshStandardMaterial color="#f8bbd0" roughness={0.6} />
        </mesh>

        {/* Distinctive Indian Zebu Hump (कूबड़ on Shoulders) */}
        <mesh position={[0, 0.44, 0.34]} scale={[0.9, 1.1, 1.15]} castShadow>
          <sphereGeometry args={[0.24, 14, 14]} />
          <meshStandardMaterial color="#795548" roughness={0.75} />
        </mesh>

        {/* Soft Folded Dewlap (लटकती गलकंबल) */}
        <mesh position={[0, -0.14, 0.56]} rotation={[0.45, 0, 0]} scale={[0.35, 1, 0.85]}>
          <capsuleGeometry args={[0.16, 0.25, 8, 12]} />
          <meshStandardMaterial color="#f8f6f0" roughness={0.75} />
        </mesh>

        {/* Red Sacred Thread & Brass Bell (गले की घंटी) */}
        <group position={[0, 0.14, 0.58]} rotation={[0.45, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.25, 0.022, 8, 20]} />
            <meshStandardMaterial color="#d32f2f" roughness={0.7} />
          </mesh>
          <group ref={bellRef} position={[0, -0.27, 0.04]}>
            <mesh castShadow>
              <coneGeometry args={[0.065, 0.11, 12]} />
              <meshStandardMaterial color="#ffd54f" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        </group>

        {/* ARTICULATED NECK & HEAD GROUP */}
        <group ref={neckGroup} position={[0, 0.22, 0.65]}>
          {/* Neck */}
          <mesh position={[0, 0.08, 0.12]} rotation={[0.6, 0, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.3, 10, 14]} />
            <meshStandardMaterial color="#f8f6f0" roughness={0.72} />
          </mesh>

          {/* Sculpted Cow Head */}
          <group ref={headGroup} position={[0, 0.22, 0.32]}>
            {/* Upper Skull & Forehead (Domed Gir Forehead) */}
            <mesh scale={[0.92, 0.95, 1.15]} castShadow>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshStandardMaterial color="#f8f6f0" roughness={0.7} />
            </mesh>

            {/* Snout Bridge */}
            <mesh position={[0, -0.05, 0.16]} rotation={[0.35, 0, 0]} scale={[0.85, 0.78, 1]} castShadow>
              <capsuleGeometry args={[0.15, 0.16, 10, 14]} />
              <meshStandardMaterial color="#f8f6f0" roughness={0.7} />
            </mesh>

            {/* Animated Chewing Muzzle / Pink Snout & Nostrils */}
            <mesh ref={jawRef} position={[0, -0.1, 0.28]} scale={[1.05, 0.8, 0.85]}>
              <sphereGeometry args={[0.145, 14, 14]} />
              <meshStandardMaterial color="#ffccbc" roughness={0.5} />
            </mesh>
            {[-0.065, 0.065].map((nx, i) => (
              <mesh key={`nostril-${i}`} position={[nx, -0.08, 0.39]}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshBasicMaterial color="#3e2723" />
              </mesh>
            ))}

            {/* Gentle Cow Eyes (Closed when Sleeping at Night!) */}
            {[-0.18, 0.18].map((ex, i) => (
              <group key={`c-eye-${i}`} position={[ex, 0.06, 0.12]}>
                {isSleeping ? (
                  /* Closed sleeping eyelid arc */
                  <mesh rotation={[0, ex < 0 ? -0.4 : 0.4, Math.PI / 2]}>
                    <capsuleGeometry args={[0.01, 0.045, 6, 8]} />
                    <meshBasicMaterial color="#3e2723" />
                  </mesh>
                ) : (
                  <>
                    <mesh>
                      <sphereGeometry args={[0.036, 10, 10]} />
                      <meshBasicMaterial color="#1f1f1f" />
                    </mesh>
                    <mesh position={[0, 0.01, 0.028]}>
                      <sphereGeometry args={[0.011, 6, 6]} />
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </>
                )}
              </group>
            ))}

            {/* Gir Pendulous Drooping Ears (लटकते कान) */}
            <mesh
              ref={leftEarRef}
              position={[-0.22, -0.02, -0.02]}
              rotation={[0.2, 0, 0.55]}
              scale={[0.6, 1.2, 0.35]}
              castShadow
            >
              <capsuleGeometry args={[0.06, 0.18, 8, 10]} />
              <meshStandardMaterial color="#795548" roughness={0.75} />
            </mesh>
            <mesh
              ref={rightEarRef}
              position={[0.22, -0.02, -0.02]}
              rotation={[0.2, 0, -0.55]}
              scale={[0.6, 1.2, 0.35]}
              castShadow
            >
              <capsuleGeometry args={[0.06, 0.18, 8, 10]} />
              <meshStandardMaterial color="#795548" roughness={0.75} />
            </mesh>

            {/* Curved Horns with Golden Brass Tips (सींग) */}
            {[-0.13, 0.13].map((hx, i) => (
              <group key={`horn-${i}`} position={[hx, 0.21, -0.04]} rotation={[-0.25, 0, hx < 0 ? -0.35 : 0.35]}>
                <mesh castShadow>
                  <coneGeometry args={[0.045, 0.28, 10]} />
                  <meshStandardMaterial color="#424242" roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.14, 0]}>
                  <sphereGeometry args={[0.022, 8, 8]} />
                  <meshStandardMaterial color="#ffd54f" metalness={0.85} roughness={0.2} />
                </mesh>
              </group>
            ))}
          </group>
        </group>

        {/* 4 ARTICULATED LEGS WITH KNEES & CLOVEN HOOVES */}
        {[
          { ref: flLeg, x: -0.22, z: 0.38, key: 'fl' },
          { ref: frLeg, x: 0.22, z: 0.38, key: 'fr' },
          { ref: blLeg, x: -0.22, z: -0.38, key: 'bl' },
          { ref: brLeg, x: 0.22, z: -0.38, key: 'br' }
        ].map((leg) => (
          <group key={leg.key} ref={leg.ref} position={[leg.x, -0.32, leg.z]}>
            <mesh position={[0, -0.12, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.2, 8, 12]} />
              <meshStandardMaterial color="#f8f6f0" roughness={0.75} />
            </mesh>
            <mesh position={[0, -0.32, 0]} castShadow>
              <capsuleGeometry args={[0.055, 0.2, 8, 12]} />
              <meshStandardMaterial color="#f8f6f0" roughness={0.75} />
            </mesh>
            <mesh position={[0, -0.45, 0.015]}>
              <cylinderGeometry args={[0.055, 0.065, 0.07, 10]} />
              <meshStandardMaterial color="#212121" roughness={0.6} />
            </mesh>
          </group>
        ))}

        {/* Swaying Tail with Dark Tuft */}
        <group ref={tailRef} position={[0, 0.14, -0.62]} rotation={[0.2, 0, 0]}>
          <mesh position={[0, -0.24, 0]}>
            <cylinderGeometry args={[0.018, 0.015, 0.48, 8]} />
            <meshStandardMaterial color="#f8f6f0" />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <coneGeometry args={[0.048, 0.16, 8]} />
            <meshStandardMaterial color="#212121" />
          </mesh>
        </group>
      </group>

      {/* Sleeping Zzz Indicator at Night */}
      {isSleeping && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.35}>
          <group position={[0, 1.35, 0.3]}>
            <Text fontSize={0.28} color="#b3e5fc" outlineWidth={0.03} outlineColor="#000000">
              💤 Zzz...
            </Text>
          </group>
        </Float>
      )}

      {/* Loved Heart Indicator */}
      {animal.loved && (
        <Float speed={3} rotationIntensity={0} floatIntensity={0.4}>
          <Text position={[0, 1.95, 0]} fontSize={0.32} color="#ff4081" outlineWidth={0.02} outlineColor="#ffffff">
            ❤️
          </Text>
        </Float>
      )}

      {/* Ready Produce Bubble */}
      {animal.isReady && (
        <Float speed={2.2} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 1.85, 0]}>
            <mesh>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshStandardMaterial color="#ffd54f" emissive="#ffc107" emissiveIntensity={0.6} />
            </mesh>
            <Text position={[0, 0, 0.27]} fontSize={0.22} color="black">
              🥛
            </Text>
          </group>
        </Float>
      )}

      {/* Hover Status Tag */}
      {hovered && (
        <Text
          position={[0, isSleeping ? 1.7 : 2.15, 0]}
          fontSize={0.18}
          color="#fff8e1"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {`${animal.name || 'गौरी'} • ${isSleeping ? '😴 सो रही है (Sleeping)' : '🌿 घास चर रही है (Grazing)'}`}
        </Text>
      )}
    </group>
  );
};

// ------------------------------------------
// 3B. DESI CHICKEN / HEN (देसी मुर्गी) - Pecking, Walking & Night Sleeping
// ------------------------------------------
const RealisticChicken: React.FC<AnimalComponentProps> = ({ animal, isNight, structures, upgrades, onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  const group = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const neckGroup = useRef<THREE.Group>(null);
  const leftWing = useRef<THREE.Mesh>(null);
  const rightWing = useRef<THREE.Mesh>(null);
  const tailGroup = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  const initialMountPos = useRef<[number, number, number]>([animal.x, 0, animal.z]);
  const waypointsRef = useRef<Point2D[]>(animal.path || []);
  const lastGoalRef = useRef<Point2D>({ x: animal.x, z: animal.z });
  const lastStructCountRef = useRef<number>(structures.length);

  const isSleeping = isNight || animal.state === 'sleeping';

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (group.current) {
      const isMoving = stepAnimalAlongPath(
        group.current,
        animal,
        structures,
        upgrades,
        waypointsRef,
        lastGoalRef,
        lastStructCountRef,
        isSleeping,
        2.15,
        0.34,
        delta
      );

      if (bodyGroup.current && neckGroup.current) {
        if (isSleeping) {
          // Nestled down into a warm feathered ball on the ground
          bodyGroup.current.position.y = THREE.MathUtils.lerp(
            bodyGroup.current.position.y,
            0.2 + Math.sin(t * 2) * 0.008,
            delta * 5
          );
          bodyGroup.current.rotation.x = THREE.MathUtils.lerp(bodyGroup.current.rotation.x, 0.08, delta * 5);
          neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, -0.35, delta * 5);
          neckGroup.current.rotation.y = THREE.MathUtils.lerp(neckGroup.current.rotation.y, 0.25, delta * 5);
        } else if (isMoving) {
          // Brisk chicken strut with rhythmic head-bobbing
          const walkBob = Math.abs(Math.sin(t * 18));
          bodyGroup.current.position.y = THREE.MathUtils.lerp(bodyGroup.current.position.y, 0.34 + walkBob * 0.04, delta * 8);
          bodyGroup.current.rotation.x = THREE.MathUtils.lerp(bodyGroup.current.rotation.x, 0.1, delta * 8);
          neckGroup.current.rotation.x = Math.sin(t * 18) * 0.25;
          neckGroup.current.rotation.y = 0;
        } else {
          // IDLE PECKING ANIMATION: Rapid bursts of sharp downward beak pecking at seeds!
          const peckBurstWindow = Math.sin(t * 1.4 + animal.z);
          const isActivelyPecking = peckBurstWindow > -0.2;

          bodyGroup.current.position.y = THREE.MathUtils.lerp(bodyGroup.current.position.y, 0.33, delta * 6);

          if (isActivelyPecking) {
            // Sharp, rapid pecking motion (6 pecks per second)
            const peckPulse = Math.max(0, Math.sin(t * 22));
            bodyGroup.current.rotation.x = THREE.MathUtils.lerp(
              bodyGroup.current.rotation.x,
              0.38 + peckPulse * 0.35,
              delta * 18
            );
            neckGroup.current.rotation.x = THREE.MathUtils.lerp(
              neckGroup.current.rotation.x,
              0.55 + peckPulse * 0.65,
              delta * 20
            );
            neckGroup.current.rotation.y = Math.sin(t * 3) * 0.12;
          } else {
            // Brief alert pause: lifts head and cocks it sideways like a real hen
            bodyGroup.current.rotation.x = THREE.MathUtils.lerp(bodyGroup.current.rotation.x, 0, delta * 8);
            neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, -0.1, delta * 8);
            neckGroup.current.rotation.y = Math.sin(t * 4.5) * 0.35;
            neckGroup.current.rotation.z = Math.cos(t * 3.5) * 0.15;
          }
        }
      }

      // Wing flutter & leg scratching
      if (leftWing.current && rightWing.current) {
        const flap = isSleeping ? 0 : Math.max(0, Math.sin(t * 9)) * 0.15;
        leftWing.current.rotation.z = flap;
        rightWing.current.rotation.z = -flap;
      }

      if (leftLeg.current && rightLeg.current) {
        if (isSleeping) {
          leftLeg.current.scale.y = THREE.MathUtils.lerp(leftLeg.current.scale.y, 0.2, delta * 6);
          rightLeg.current.scale.y = THREE.MathUtils.lerp(rightLeg.current.scale.y, 0.2, delta * 6);
        } else {
          leftLeg.current.scale.y = THREE.MathUtils.lerp(leftLeg.current.scale.y, 1, delta * 6);
          rightLeg.current.scale.y = THREE.MathUtils.lerp(rightLeg.current.scale.y, 1, delta * 6);
          if (isMoving) {
            const stride = Math.sin(t * 18) * 0.6;
            leftLeg.current.rotation.x = stride;
            rightLeg.current.rotation.x = -stride;
          } else {
            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, delta * 8);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, delta * 8);
          }
        }
      }

      if (tailGroup.current) {
        tailGroup.current.rotation.x = isSleeping ? -0.1 : Math.sin(t * 8) * 0.08;
      }
    }
  });

  return (
    <group
      ref={group}
      position={initialMountPos.current}
      onClick={(e) => {
        e.stopPropagation();
        villageAudio.playChicken();
        onClick(animal.id);
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Shadow */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#000000" opacity={0.28} transparent />
      </mesh>

      {/* Scattered Golden Grain Seeds on Ground for Pecking */}
      {!isSleeping && (
        <group position={[0, 0.015, 0.28]}>
          {[-0.05, 0.02, 0.06, -0.02].map((gx, i) => (
            <mesh key={`seed-grain-${i}`} position={[gx, 0, (i - 1.5) * 0.04]}>
              <sphereGeometry args={[0.016, 6, 6]} />
              <meshBasicMaterial color="#ffd54f" />
            </mesh>
          ))}
        </group>
      )}

      {/* Plump Feathered Chicken Body */}
      <group ref={bodyGroup} position={[0, 0.33, 0]}>
        <mesh scale={[0.88, 0.92, 1.22]} castShadow receiveShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#d84315" roughness={0.8} />
        </mesh>

        {/* Breast Plumage */}
        <mesh position={[0, 0.02, 0.14]} scale={[0.78, 0.85, 0.8]} castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#ef6c00" roughness={0.8} />
        </mesh>

        {/* Left & Right Feathered Wings */}
        <mesh
          ref={leftWing}
          position={[-0.17, 0.02, 0]}
          scale={[0.3, 0.72, 1.05]}
          castShadow
        >
          <sphereGeometry args={[0.17, 12, 12]} />
          <meshStandardMaterial color="#bf360c" roughness={0.85} />
        </mesh>
        <mesh
          ref={rightWing}
          position={[0.17, 0.02, 0]}
          scale={[0.3, 0.72, 1.05]}
          castShadow
        >
          <sphereGeometry args={[0.17, 12, 12]} />
          <meshStandardMaterial color="#bf360c" roughness={0.85} />
        </mesh>

        {/* Arched Tail Feathers (दुम के पंख) */}
        <group ref={tailGroup} position={[0, 0.1, -0.22]} rotation={[-0.45, 0, 0]}>
          {[-0.04, 0, 0.04].map((tx, i) => (
            <mesh key={`tail-feather-${i}`} position={[tx, 0.06, 0]} rotation={[0, 0, (i - 1) * 0.2]} castShadow>
              <coneGeometry args={[0.045, 0.22, 8]} />
              <meshStandardMaterial color={i === 1 ? '#1b5e20' : '#3e2723'} roughness={0.75} />
            </mesh>
          ))}
        </group>

        {/* Articulated Neck, Head, Red Comb (Kalgi) & Beak */}
        <group ref={neckGroup} position={[0, 0.14, 0.18]}>
          {/* Neck Feathers */}
          <mesh position={[0, 0.07, 0.03]} rotation={[0.3, 0, 0]} castShadow>
            <coneGeometry args={[0.095, 0.2, 12]} />
            <meshStandardMaterial color="#f57c00" roughness={0.8} />
          </mesh>

          {/* Head */}
          <group position={[0, 0.17, 0.06]}>
            <mesh castShadow>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshStandardMaterial color="#e65100" roughness={0.75} />
            </mesh>

            {/* Bright Red Comb (लाल कलगी) */}
            <group position={[0, 0.085, 0]}>
              {[-0.025, 0, 0.025].map((cx, i) => (
                <mesh key={`comb-${i}`} position={[0, 0, cx]} scale={[0.45, 1.1, 0.8]}>
                  <sphereGeometry args={[0.032, 8, 8]} />
                  <meshStandardMaterial color="#d50000" roughness={0.5} />
                </mesh>
              ))}
            </group>

            {/* Red Wattle under Beak */}
            <mesh position={[0, -0.065, 0.055]} scale={[0.5, 1, 0.7]}>
              <sphereGeometry args={[0.028, 8, 8]} />
              <meshStandardMaterial color="#d50000" roughness={0.5} />
            </mesh>

            {/* Sharp Golden-Yellow Pecking Beak */}
            <mesh position={[0, -0.01, 0.11]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <coneGeometry args={[0.028, 0.08, 8]} />
              <meshStandardMaterial color="#ffb300" roughness={0.4} />
            </mesh>

            {/* Chicken Eyes */}
            {[-0.068, 0.068].map((ex, i) => (
              <mesh key={`chk-eye-${i}`} position={[ex, 0.015, 0.035]}>
                <sphereGeometry args={[isSleeping ? 0.006 : 0.016, 8, 8]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
            ))}
          </group>
        </group>

        {/* Two Yellow Legs with Claws */}
        <group ref={leftLeg} position={[-0.07, -0.16, 0.02]}>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.014, 0.012, 0.16, 6]} />
            <meshStandardMaterial color="#fbc02d" />
          </mesh>
          <mesh position={[0, -0.16, 0.02]}>
            <boxGeometry args={[0.05, 0.015, 0.07]} />
            <meshStandardMaterial color="#fbc02d" />
          </mesh>
        </group>

        <group ref={rightLeg} position={[0.07, -0.16, 0.02]}>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.014, 0.012, 0.16, 6]} />
            <meshStandardMaterial color="#fbc02d" />
          </mesh>
          <mesh position={[0, -0.16, 0.02]}>
            <boxGeometry args={[0.05, 0.015, 0.07]} />
            <meshStandardMaterial color="#fbc02d" />
          </mesh>
        </group>
      </group>

      {/* Sleeping Zzz at Night */}
      {isSleeping && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
          <Text position={[0, 0.85, 0]} fontSize={0.22} color="#b3e5fc" outlineWidth={0.025} outlineColor="#000000">
            💤 Zzz
          </Text>
        </Float>
      )}

      {animal.loved && (
        <Float speed={3} rotationIntensity={0} floatIntensity={0.4}>
          <Text position={[0, 1.15, 0]} fontSize={0.26} color="#ff4081">
            ❤️
          </Text>
        </Float>
      )}

      {animal.isReady && (
        <Float speed={2.2} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 1.05, 0]}>
            <mesh>
              <sphereGeometry args={[0.2, 12, 12]} />
              <meshStandardMaterial color="#fff9c4" emissive="#fbc02d" emissiveIntensity={0.5} />
            </mesh>
            <Text position={[0, 0, 0.22]} fontSize={0.18} color="black">
              🥚
            </Text>
          </group>
        </Float>
      )}

      {hovered && (
        <Text
          position={[0, 1.25, 0]}
          fontSize={0.16}
          color="#fff8e1"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`${animal.name || 'सुंदरी'} • ${isSleeping ? '😴 सो रही है (Sleeping)' : '🌾 दाना चुग रही है (Pecking)'}`}
        </Text>
      )}
    </group>
  );
};

// ------------------------------------------
// 3C. DESI GOAT (देसी बकरी) - Browsing/Grazing, Tail-Wagging & Night Sleeping
// ------------------------------------------
const RealisticGoat: React.FC<AnimalComponentProps> = ({ animal, isNight, structures, upgrades, onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  const group = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const neckGroup = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const beardRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const flLeg = useRef<THREE.Group>(null);
  const frLeg = useRef<THREE.Group>(null);
  const blLeg = useRef<THREE.Group>(null);
  const brLeg = useRef<THREE.Group>(null);

  const initialMountPos = useRef<[number, number, number]>([animal.x, 0, animal.z]);
  const waypointsRef = useRef<Point2D[]>(animal.path || []);
  const lastGoalRef = useRef<Point2D>({ x: animal.x, z: animal.z });
  const lastStructCountRef = useRef<number>(structures.length);

  const isSleeping = isNight || animal.state === 'sleeping';

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (group.current) {
      const isMoving = stepAnimalAlongPath(
        group.current,
        animal,
        structures,
        upgrades,
        waypointsRef,
        lastGoalRef,
        lastStructCountRef,
        isSleeping,
        2.0,
        0.42,
        delta
      );

      if (bodyGroup.current && neckGroup.current && headGroup.current) {
        if (isSleeping) {
          bodyGroup.current.position.y = THREE.MathUtils.lerp(
            bodyGroup.current.position.y,
            0.3 + Math.sin(t * 1.8) * 0.01,
            delta * 5
          );
          neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, 0.45, delta * 5);
          neckGroup.current.rotation.y = THREE.MathUtils.lerp(neckGroup.current.rotation.y, -0.25, delta * 5);
          headGroup.current.rotation.x = THREE.MathUtils.lerp(headGroup.current.rotation.x, 0.2, delta * 5);
        } else if (isMoving) {
          // Nimble goat trot
          bodyGroup.current.position.y = 0.58 + Math.abs(Math.sin(t * 12)) * 0.05;
          neckGroup.current.rotation.x = THREE.MathUtils.lerp(neckGroup.current.rotation.x, 0.05, delta * 6);
          headGroup.current.rotation.x = Math.sin(t * 12) * 0.08;
        } else {
          // Goat grazing & playful browsing
          const browseWave = Math.sin(t * 0.9 + animal.x);
          const isNibbling = browseWave > -0.25;
          bodyGroup.current.position.y = THREE.MathUtils.lerp(bodyGroup.current.position.y, 0.56, delta * 5);
          neckGroup.current.rotation.x = THREE.MathUtils.lerp(
            neckGroup.current.rotation.x,
            isNibbling ? 0.62 + Math.sin(t * 6) * 0.05 : -0.05,
            delta * 6
          );
          headGroup.current.rotation.z = Math.sin(t * 9) * 0.06;
          headGroup.current.rotation.y = isNibbling ? Math.sin(t * 3) * 0.12 : Math.sin(t * 2) * 0.25;
        }
      }

      if (beardRef.current) {
        beardRef.current.rotation.z = isSleeping ? 0 : Math.sin(t * 10) * 0.14;
      }

      if (tailRef.current) {
        tailRef.current.rotation.z = isSleeping ? 0 : Math.sin(t * 15) * 0.25;
      }

      const legs = [flLeg.current, frLeg.current, blLeg.current, brLeg.current];
      if (legs[0] && legs[1] && legs[2] && legs[3]) {
        if (isSleeping) {
          legs[0].rotation.x = THREE.MathUtils.lerp(legs[0].rotation.x, 1.3, delta * 5);
          legs[1].rotation.x = THREE.MathUtils.lerp(legs[1].rotation.x, 1.3, delta * 5);
          legs[2].rotation.x = THREE.MathUtils.lerp(legs[2].rotation.x, -1.3, delta * 5);
          legs[3].rotation.x = THREE.MathUtils.lerp(legs[3].rotation.x, -1.3, delta * 5);
        } else if (isMoving) {
          const stride = Math.sin(t * 12) * 0.5;
          legs[0].rotation.x = stride;
          legs[1].rotation.x = -stride;
          legs[2].rotation.x = -stride;
          legs[3].rotation.x = stride;
        } else {
          legs.forEach((l) => {
            if (l) l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, delta * 6);
          });
        }
      }
    }
  });

  return (
    <group
      ref={group}
      position={initialMountPos.current}
      onClick={(e) => {
        e.stopPropagation();
        villageAudio.playGoat();
        onClick(animal.id);
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Shadow */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.35, 1]}>
        <circleGeometry args={[0.52, 20]} />
        <meshBasicMaterial color="#000000" opacity={0.28} transparent />
      </mesh>

      <group ref={bodyGroup} position={[0, 0.56, 0]}>
        {/* Sculpted Goat Torso */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.26, 0.52, 10, 16]} />
          <meshStandardMaterial color="#5d4037" roughness={0.8} />
        </mesh>

        {/* White Belly Patch */}
        <mesh position={[0, -0.05, 0]} scale={[1.03, 0.85, 0.7]}>
          <sphereGeometry args={[0.25, 12, 12]} />
          <meshStandardMaterial color="#efebe9" roughness={0.85} />
        </mesh>

        {/* Perky Upright Goat Tail */}
        <mesh ref={tailRef} position={[0, 0.22, -0.42]} rotation={[-0.5, 0, 0]} castShadow>
          <coneGeometry args={[0.045, 0.18, 8]} />
          <meshStandardMaterial color="#3e2723" />
        </mesh>

        {/* Neck & Head */}
        <group ref={neckGroup} position={[0, 0.16, 0.38]}>
          <mesh position={[0, 0.1, 0.06]} rotation={[0.45, 0, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.22, 8, 12]} />
            <meshStandardMaterial color="#5d4037" roughness={0.8} />
          </mesh>

          <group ref={headGroup} position={[0, 0.25, 0.16]}>
            <mesh scale={[0.85, 0.9, 1.2]} castShadow>
              <sphereGeometry args={[0.14, 14, 14]} />
              <meshStandardMaterial color="#4e342e" roughness={0.75} />
            </mesh>
            {/* Tapering Goat Snout */}
            <mesh position={[0, -0.04, 0.14]} rotation={[1.2, 0, 0]} castShadow>
              <coneGeometry args={[0.085, 0.18, 10]} />
              <meshStandardMaterial color="#3e2723" roughness={0.7} />
            </mesh>
            {/* Goat Chin Beard (बकरी की दाढ़ी) */}
            <mesh ref={beardRef} position={[0, -0.14, 0.14]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.035, 0.12, 6]} />
              <meshStandardMaterial color="#efebe9" />
            </mesh>
            {/* Long Pendulous Indian Goat Ears */}
            {[-0.14, 0.14].map((ex, i) => (
              <mesh
                key={`g-ear-${i}`}
                position={[ex, -0.02, -0.02]}
                rotation={[0.2, 0, ex < 0 ? 0.45 : -0.45]}
                scale={[0.45, 1.2, 0.3]}
              >
                <capsuleGeometry args={[0.04, 0.14, 6, 8]} />
                <meshStandardMaterial color="#4e342e" />
              </mesh>
            ))}
            {/* Backward-Curved Horns */}
            {[-0.07, 0.07].map((hx, i) => (
              <mesh key={`g-horn-${i}`} position={[hx, 0.16, -0.04]} rotation={[-0.5, 0, hx < 0 ? -0.15 : 0.15]}>
                <coneGeometry args={[0.028, 0.22, 8]} />
                <meshStandardMaterial color="#212121" roughness={0.5} />
              </mesh>
            ))}
            {/* Goat Eyes */}
            {[-0.11, 0.11].map((ex, i) => (
              <mesh key={`g-eye-${i}`} position={[ex, 0.03, 0.06]}>
                <sphereGeometry args={[isSleeping ? 0.008 : 0.022, 8, 8]} />
                <meshBasicMaterial color={isSleeping ? '#212121' : '#ffd54f'} />
              </mesh>
            ))}
          </group>
        </group>

        {/* 4 Slender Goat Legs */}
        {[
          { ref: flLeg, x: -0.14, z: 0.25, key: 'g-fl' },
          { ref: frLeg, x: 0.14, z: 0.25, key: 'g-fr' },
          { ref: blLeg, x: -0.14, z: -0.25, key: 'g-bl' },
          { ref: brLeg, x: 0.14, z: -0.25, key: 'g-br' }
        ].map((leg) => (
          <group key={leg.key} ref={leg.ref} position={[leg.x, -0.2, leg.z]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <capsuleGeometry args={[0.04, 0.24, 6, 10]} />
              <meshStandardMaterial color="#4e342e" />
            </mesh>
            <mesh position={[0, -0.32, 0]}>
              <cylinderGeometry args={[0.038, 0.044, 0.05, 8]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
        ))}
      </group>

      {isSleeping && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
          <Text position={[0, 1.05, 0]} fontSize={0.24} color="#b3e5fc" outlineWidth={0.025} outlineColor="#000000">
            💤 Zzz...
          </Text>
        </Float>
      )}

      {animal.loved && (
        <Float speed={3} rotationIntensity={0} floatIntensity={0.4}>
          <Text position={[0, 1.4, 0]} fontSize={0.28} color="#ff4081">
            ❤️
          </Text>
        </Float>
      )}

      {animal.isReady && (
        <Float speed={2.2} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 1.35, 0]}>
            <mesh>
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshStandardMaterial color="#ffd54f" emissive="#ffc107" emissiveIntensity={0.6} />
            </mesh>
            <Text position={[0, 0, 0.24]} fontSize={0.2} color="black">
              🥛
            </Text>
          </group>
        </Float>
      )}

      {hovered && (
        <Text
          position={[0, 1.55, 0]}
          fontSize={0.17}
          color="#fff8e1"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`${animal.name || 'चंपा'} • ${isSleeping ? '😴 सो रही है (Sleeping)' : '🌿 पत्तियाँ चर रही है (Grazing)'}`}
        </Text>
      )}
    </group>
  );
};

// ==========================================
// 4. REALISTIC VEHICLES: TEMPO & ROADWAYS BUS
// ==========================================

const RealisticTempo: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}> = ({ position, rotation = [0, 0, 0], onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  return (
    <group
      position={position}
      rotation={new THREE.Euler(...rotation)}
      onClick={(e) => {
        e.stopPropagation();
        villageAudio.playHorn();
        if (onClick) onClick();
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Chassis Base */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.2, 2.6]} />
        <meshStandardMaterial color="#263238" roughness={0.8} />
      </mesh>

      {/* Front Aerodynamic Sloping Cabin (Yellow) */}
      <mesh position={[0, 0.85, 0.8]} castShadow>
        <boxGeometry args={[1.35, 0.8, 1]} />
        <meshStandardMaterial color="#fbc02d" roughness={0.5} />
      </mesh>

      {/* Lower Green Body Panels */}
      <mesh position={[0, 0.65, -0.3]} castShadow>
        <boxGeometry args={[1.48, 0.45, 1.6]} />
        <meshStandardMaterial color="#00796b" roughness={0.5} />
      </mesh>

      {/* Windshield Glass with Rubber Beading */}
      <mesh position={[0, 1.1, 1.2]}>
        <boxGeometry args={[1.15, 0.55, 0.05]} />
        <meshStandardMaterial color="#b3e5fc" roughness={0.1} transparent opacity={0.8} />
      </mesh>

      {/* Chrome Headlight with Yellow Turn Indicators */}
      <mesh position={[0, 0.75, 1.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#eceff1" metalness={0.9} roughness={0.1} />
      </mesh>
      {[-0.45, 0.45].map((ix) => (
        <mesh key={`indic-${ix}`} position={[ix, 0.75, 1.32]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#ff9800" />
        </mesh>
      ))}

      {/* Front Wheel Fork & Mudguard */}
      <mesh position={[0, 0.5, 1.35]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
        <meshStandardMaterial color="#37474f" metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.32, 1.35]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.16, 20]} />
        <meshStandardMaterial color="#212121" roughness={0.9} />
      </mesh>

      {/* Rear Dual Wheels */}
      {[-0.78, 0.78].map((wx) => (
        <mesh key={`tempo-wheel-${wx}`} position={[wx, 0.35, -0.6]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.18, 20]} />
          <meshStandardMaterial color="#212121" roughness={0.9} />
        </mesh>
      ))}

      {/* Yellow Canvas Canopy */}
      <mesh position={[0, 1.5, -0.2]} castShadow>
        <boxGeometry args={[1.44, 0.7, 1.7]} />
        <meshStandardMaterial color="#fbc02d" roughness={0.7} />
      </mesh>

      {/* Rear Bumper */}
      <mesh position={[0, 0.35, -1.32]}>
        <boxGeometry args={[1.3, 0.2, 0.06]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>

      <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
        <group position={[0, 2.3, 0]}>
          <Text
            fontSize={0.28}
            color={hovered ? '#ffeb3b' : '#ffffff'}
            outlineWidth={0.03}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            🛺 देसी टेम्पो (Tempo)
          </Text>
        </group>
      </Float>
    </group>
  );
};

const RealisticRoadwaysBus: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}> = ({ position, rotation = [0, 0, 0], onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  return (
    <group
      position={position}
      rotation={new THREE.Euler(...rotation)}
      onClick={(e) => {
        e.stopPropagation();
        villageAudio.playHorn();
        if (onClick) onClick();
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Main Bus Body */}
      <mesh position={[0, 1.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.85, 7.2]} />
        <meshStandardMaterial color="#e64a19" roughness={0.6} />
      </mesh>

      {/* Cream Trim Belt */}
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[2.54, 0.32, 7.22]} />
        <meshStandardMaterial color="#fff3e0" />
      </mesh>

      {/* Split Front Windshield */}
      <mesh position={[0, 1.8, 3.62]}>
        <boxGeometry args={[2.1, 0.75, 0.04]} />
        <meshStandardMaterial color="#b3e5fc" roughness={0.1} transparent opacity={0.8} />
      </mesh>

      {/* Destination Board */}
      <mesh position={[0, 2.25, 3.62]}>
        <boxGeometry args={[1.8, 0.28, 0.05]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Chrome Radiator Grill */}
      <mesh position={[0, 0.85, 3.62]}>
        <boxGeometry args={[1.8, 0.6, 0.05]} />
        <meshStandardMaterial color="#455a64" metalness={0.8} roughness={0.2} />
      </mesh>
      {[-0.8, 0.8].map((hx) => (
        <mesh key={`bus-headlight-${hx}`} position={[hx, 0.9, 3.64]}>
          <circleGeometry args={[0.16, 16]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
      ))}

      {/* Roof Luggage Carrier Rack */}
      <mesh position={[0, 2.45, -0.4]}>
        <boxGeometry args={[2.3, 0.22, 5]} />
        <meshStandardMaterial color="#212121" metalness={0.7} />
      </mesh>
      <mesh position={[-0.45, 2.7, 0]} castShadow>
        <boxGeometry args={[0.8, 0.45, 1.2]} />
        <meshStandardMaterial color="#1565c0" />
      </mesh>
      <mesh position={[0.45, 2.7, -0.9]} castShadow>
        <boxGeometry args={[0.85, 0.5, 1.1]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>

      {/* Heavy Duty Bus Wheels */}
      {[-1.25, 1.25].map((wx) => (
        <React.Fragment key={`bus-wheels-${wx}`}>
          <mesh position={[wx, 0.52, 2]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.52, 0.52, 0.28, 20]} />
            <meshStandardMaterial color="#212121" roughness={0.9} />
          </mesh>
          <mesh position={[wx, 0.52, -2]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.52, 0.52, 0.32, 20]} />
            <meshStandardMaterial color="#212121" roughness={0.9} />
          </mesh>
        </React.Fragment>
      ))}

      <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
        <group position={[0, 3.4, 0]}>
          <Text
            fontSize={0.34}
            color={hovered ? '#ffd54f' : '#ffffff'}
            outlineWidth={0.03}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            🚌 गाँव रोडवेज बस (Bus Stand)
          </Text>
        </group>
      </Float>
    </group>
  );
};

// ==========================================
// 5. REALISTIC HOUSES: KACHA, PAKKA & CHHAPPAR
// ==========================================

const RealisticKachaGhar: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.15, 0]} receiveShadow>
      <boxGeometry args={[5.2, 0.3, 4.2]} />
      <meshStandardMaterial color="#8d6e63" roughness={0.9} />
    </mesh>
    <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
      <boxGeometry args={[4.8, 2.5, 3.8]} />
      <meshStandardMaterial color="#bcaaa4" roughness={0.95} />
    </mesh>
    <mesh position={[0, 3.1, 0]} castShadow>
      <coneGeometry args={[3.8, 1.8, 4]} />
      <meshStandardMaterial color="#bf360c" roughness={0.8} />
    </mesh>
    <mesh position={[0, 1.1, 1.94]}>
      <boxGeometry args={[1.2, 1.9, 0.08]} />
      <meshStandardMaterial color="#4e342e" roughness={0.7} />
    </mesh>
    <mesh position={[-1.4, 1.4, 1.94]}>
      <boxGeometry args={[0.8, 0.8, 0.06]} />
      <meshStandardMaterial color="#3e2723" />
    </mesh>
    <group position={[1.8, 0.5, 2.5]}>
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.7, 0.6]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
    </group>
  </group>
);

const RealisticPakkaGhar: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
      <boxGeometry args={[5.8, 3.2, 4.6]} />
      <meshStandardMaterial color="#80deea" roughness={0.6} />
    </mesh>
    <mesh position={[0, 4.4, 0]} castShadow receiveShadow>
      <boxGeometry args={[5.5, 2.6, 4.3]} />
      <meshStandardMaterial color="#b2ebf2" roughness={0.6} />
    </mesh>
    <mesh position={[0, 5.8, 0]} castShadow>
      <boxGeometry args={[5.7, 0.35, 4.5]} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
    <group position={[-1.5, 6.4, -1]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.55, 0.55, 1, 16]} />
        <meshStandardMaterial color="#212121" roughness={0.7} />
      </mesh>
    </group>
    <group position={[1.5, 6.3, -1]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0.6, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
    </group>
    {[-1.6, 1.6].map((wx) => (
      <mesh key={`p-win-${wx}`} position={[wx, 1.6, 2.33]}>
        <boxGeometry args={[0.9, 1, 0.06]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
    ))}
  </group>
);

const RealisticChhapparGhar: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.15, 0]} receiveShadow>
      <boxGeometry args={[4.6, 0.3, 3.8]} />
      <meshStandardMaterial color="#8d6e63" />
    </mesh>
    <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
      <boxGeometry args={[4.2, 2.3, 3.4]} />
      <meshStandardMaterial color="#a1887f" />
    </mesh>
    <mesh position={[0, 2.7, 0]} castShadow>
      <coneGeometry args={[3.2, 1.5, 4]} />
      <meshStandardMaterial color="#fdd835" roughness={1} />
    </mesh>
    {[-1.8, 1.8].map((bx) => (
      <mesh key={`post-${bx}`} position={[bx, 1.1, 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
    ))}
    <group position={[0, 0.25, 2.3]}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 0.8]} />
        <meshStandardMaterial color="#d84315" wireframe />
      </mesh>
    </group>
  </group>
);

// ==========================================
// 6. REALISTIC VILLAGE POND (TALAB) & BUFFALOES
// ==========================================

const RealisticVillageTalab: React.FC<{ position: [number, number, number]; onClick?: () => void }> = ({ position, onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (waterRef.current) {
      waterRef.current.position.y = 0.05 + Math.sin(state.clock.elapsedTime * 1.5) * 0.02;
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        villageAudio.playPondSplash();
        if (onClick) onClick();
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[5.6, 6.8, 32]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>

      <mesh ref={waterRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.7, 32]} />
        <meshStandardMaterial color="#00acc1" roughness={0.15} metalness={0.25} transparent opacity={0.88} />
      </mesh>

      <group position={[0, 0.15, 5.2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.8, 0.25, 1.2]} />
          <meshStandardMaterial color="#bcaaa4" />
        </mesh>
        <mesh position={[0, -0.15, 0.8]} receiveShadow>
          <boxGeometry args={[3.8, 0.25, 0.8]} />
          <meshStandardMaterial color="#a1887f" />
        </mesh>
      </group>

      {[-2, 1.2, 3, -1.8].map((lx, i) => (
        <group key={`pond-lotus-${i}`} position={[lx, 0.07, (i % 2 === 0 ? 1 : -1) * 2]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.36, 12]} />
            <meshStandardMaterial color="#2e7d32" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <coneGeometry args={[0.16, 0.18, 8]} />
            <meshStandardMaterial color="#e91e63" />
          </mesh>
        </group>
      ))}

      {[-2.2, 2.4].map((bx, i) => (
        <group key={`pond-buffalo-${i}`} position={[bx, 0.12, (i === 0 ? -1.2 : 0.8)]} rotation={[0, (i === 0 ? 0.4 : -0.7), 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.55, 0.42, 0.7]} />
            <meshStandardMaterial color="#212121" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.06, 0.42]}>
            <boxGeometry args={[0.42, 0.22, 0.28]} />
            <meshStandardMaterial color="#37474f" />
          </mesh>
          <mesh position={[-0.34, 0.22, -0.1]} rotation={[0, 0, 0.7]}>
            <cylinderGeometry args={[0.04, 0.07, 0.45, 8]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          <mesh position={[0.34, 0.22, -0.1]} rotation={[0, 0, -0.7]}>
            <cylinderGeometry args={[0.04, 0.07, 0.45, 8]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        </group>
      ))}

      <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
        <group position={[0, 2.2, 0]}>
          <Text
            fontSize={0.34}
            color={hovered ? '#4dd0e1' : '#ffffff'}
            outlineWidth={0.03}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            🌊 गाँव का तालाब (Village Talab)
          </Text>
        </group>
      </Float>
    </group>
  );
};

// ==========================================
// 7. PLAYER-BUILT FARM STRUCTURES & UPGRADES
// ==========================================

const BuiltStructureMesh: React.FC<{ structure: Structure }> = ({ structure }) => {
  if (structure.type === StructureType.COWSHED) {
    return (
      <group position={[structure.x, 0, structure.z]} rotation={[0, structure.rotation, 0]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[3.4, 0.2, 2.8]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
        {[-1.4, 1.4].map((px) =>
          [-1.1, 1.1].map((pz) => (
            <mesh key={`shed-p-${px}-${pz}`} position={[px, 1.1, pz]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 2.2, 8]} />
              <meshStandardMaterial color="#5d4037" />
            </mesh>
          ))
        )}
        <mesh position={[0, 2.3, 0]} castShadow>
          <coneGeometry args={[2.5, 1.2, 4]} />
          <meshStandardMaterial color="#fbc02d" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  if (structure.type === StructureType.CHICKEN_COOP) {
    return (
      <group position={[structure.x, 0, structure.z]} rotation={[0, structure.rotation, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 1.2, 1.6]} />
          <meshStandardMaterial color="#a1887f" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <coneGeometry args={[1.4, 0.8, 4]} />
          <meshStandardMaterial color="#d84315" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[structure.x, 0, structure.z]}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.95, 2.8, 16]} />
        <meshStandardMaterial color="#bcaaa4" roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <coneGeometry args={[1.1, 0.9, 16]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
    </group>
  );
};

// ==========================================
// 8. VILLAGE ENVIRONMENT ASSEMBLY
// ==========================================

const VillageAssembly: React.FC<{
  isNight: boolean;
  structures: Structure[];
  upgrades: UpgradeType[];
  onPlaneClick: (point: THREE.Vector3) => void;
  onChulhaClick: () => void;
  onTempleClick: () => void;
  onWellClick: () => void;
  onShopClick: () => void;
  onNPCClick: (id: number) => void;
  onTalabClick?: () => void;
  onChaiClick?: () => void;
  onTempoClick?: () => void;
  onSleepClick?: () => void;
  onOpenRules?: () => void;
}> = ({
  isNight,
  structures,
  upgrades,
  onPlaneClick,
  onChulhaClick,
  onTempleClick,
  onWellClick,
  onShopClick,
  onNPCClick,
  onTalabClick,
  onChaiClick,
  onTempoClick,
  onSleepClick,
  onOpenRules
}) => {
  return (
    <group>
      {/* 1. Base Terrain Grass */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onPlaneClick(e.point);
        }}
      >
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={COLORS.GRASS} roughness={0.8} />
      </mesh>

      {/* 2. Paved Asphalt Road (Sadak) with White Lane Markers */}
      <group position={[0, -0.03, 17]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 5.5]} />
          <meshStandardMaterial color={COLORS.ROAD} roughness={0.7} />
        </mesh>
        {[-35, -25, -15, -5, 5, 15, 25, 35].map((lx) => (
          <mesh key={`dash-${lx}`} position={[lx, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4, 0.25]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>

      {/* 3. Village Dirt Pathways (Pagdandi) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 2]} receiveShadow>
        <planeGeometry args={[4, 28]} />
        <meshStandardMaterial color={COLORS.ROAD_DIRT} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 2]} receiveShadow>
        <planeGeometry args={[36, 4]} />
        <meshStandardMaterial color={COLORS.ROAD_DIRT} roughness={0.9} />
      </mesh>

      {/* 4. HOUSES */}
      <RealisticKachaGhar position={[-6.5, 0, -6]} />
      <RealisticPakkaGhar position={[-15, 0, -8]} />
      <RealisticChhapparGhar position={[15, 0, -6]} />

      {/* 5. TALAB (VILLAGE POND) */}
      <RealisticVillageTalab position={[-14, 0, 8.5]} onClick={onTalabClick} />

      {/* 6. VEHICLES */}
      <RealisticTempo position={[3, 0, 14.5]} rotation={[0, -0.25, 0]} onClick={onTempoClick} />
      <RealisticRoadwaysBus position={[-18, 0, 17]} rotation={[0, 0, 0]} onClick={onTempoClick} />

      {/* Optional Farm Upgrades (Scarecrow & Tractor) */}
      {upgrades.includes(UpgradeType.SCARECROW) && (
        <group position={[0, 0, -4.5]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 1.6, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color="#e65100" />
          </mesh>
        </group>
      )}

      {/* 7. MANDIR, WELL & MARKET */}
      <group position={[0, 0, -14]} onClick={(e) => { e.stopPropagation(); onTempleClick(); }}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.5, 0.8, 5.5]} />
          <meshStandardMaterial color="#d7ccc8" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 2.8, 4]} />
          <meshStandardMaterial color="#fff3e0" roughness={0.8} />
        </mesh>
        <mesh position={[0, 4.8, 0]} castShadow>
          <coneGeometry args={[2.3, 2.6, 4]} />
          <meshStandardMaterial color="#ff9800" roughness={0.7} />
        </mesh>
        <mesh position={[0, 6.3, 0]} castShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 3.8, 2.3]} fontSize={0.34} color="#ffd54f" outlineWidth={0.03} outlineColor="#000000">
            🕉️ गाँव मंदिर (Mandir)
          </Text>
        </Float>
      </group>

      {/* Well */}
      <group position={[6, 0, -6]} onClick={(e) => { e.stopPropagation(); onWellClick(); }}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.25, 0.9, 20]} />
          <meshStandardMaterial color="#9e9e9e" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.05, 20]} />
          <meshStandardMaterial color="#0288d1" roughness={0.1} />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 2.6, 0]} fontSize={0.28} color="#4fc3f7" outlineWidth={0.03} outlineColor="#000000">
            💧 गाँव का कुआँ (Well)
          </Text>
        </Float>
      </group>

      {/* Lala Ji Market Stall */}
      <group position={[9, 0, 1.5]} onClick={(e) => { e.stopPropagation(); onShopClick(); }}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.8, 1.8]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
        <mesh position={[0, 2.5, 0]} castShadow>
          <boxGeometry args={[3.6, 0.1, 2.2]} />
          <meshStandardMaterial color="#d32f2f" />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 3.1, 0]} fontSize={0.3} color="#ffd54f" outlineWidth={0.03} outlineColor="#000000">
            🏪 गाँव हाट / मंडी (Market)
          </Text>
        </Float>
      </group>

      {/* Fertilizer & Manure Shop Stall (देसी खाद भंडार) in the Mandi */}
      <group position={[9.4, 0, -1.8]} onClick={(e) => { e.stopPropagation(); onShopClick(); }}>
        {/* Shop Counter */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.85, 1.6]} />
          <meshStandardMaterial color="#4e342e" roughness={0.9} />
        </mesh>
        {/* Bamboo Support Pillars */}
        {[-1.15, 1.15].map((px) =>
          [-0.65, 0.65].map((pz) => (
            <mesh key={`fert-pole-${px}-${pz}`} position={[px, 1.25, pz]} castShadow>
              <cylinderGeometry args={[0.045, 0.05, 2.4, 8]} />
              <meshStandardMaterial color="#8d6e63" />
            </mesh>
          ))
        )}
        {/* Green Organic Awning Roof */}
        <mesh position={[0, 2.45, 0]} castShadow>
          <boxGeometry args={[2.9, 0.12, 1.9]} />
          <meshStandardMaterial color="#2e7d32" />
        </mesh>
        {/* Stacked Manure & Vermicompost Burlap Sacks on Counter */}
        {[-0.65, 0, 0.65].map((sx, idx) => (
          <group key={`manure-sack-${idx}`} position={[sx, 1.05, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.2, 0.24, 8, 10]} />
              <meshStandardMaterial color={idx === 2 ? '#fbc02d' : idx === 1 ? '#43a047' : '#8d6e63'} roughness={0.95} />
            </mesh>
          </group>
        ))}
        <Float speed={2.2} rotationIntensity={0} floatIntensity={0.22}>
          <Text position={[0, 3.05, 0]} fontSize={0.27} color="#aeea00" outlineWidth={0.03} outlineColor="#000000">
            🧪 देसी खाद भंडार (Fertilizer Shop)
          </Text>
        </Float>
      </group>

      {/* Chai Tapri */}
      <group position={[14, 0, 2]} onClick={(e) => { e.stopPropagation(); if (onChaiClick) onChaiClick(); }}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.9, 1.4]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 1.8, 0]} fontSize={0.28} color="#ff9800" outlineWidth={0.03} outlineColor="#000000">
            ☕ राजू की चाय टपरी (Chai Tapri)
          </Text>
        </Float>
      </group>

      {/* Chulha Stove */}
      <group position={[-4.5, 0, -3.5]} onClick={(e) => { e.stopPropagation(); onChulhaClick(); }}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[1, 0.6, 1]} />
          <meshStandardMaterial color={COLORS.CHULHA} />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 1.2, 0]} fontSize={0.28} color="#ff9800" outlineWidth={0.03} outlineColor="#000000">
            🔥 चूल्हा (Cook)
          </Text>
        </Float>
      </group>

      {/* Interactive Courtyard Charpai (खाट पर सोएं / विश्राम करें) */}
      <group
        position={[-7.8, 0, -3.2]}
        rotation={[0, 0.25, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (onSleepClick) onSleepClick();
        }}
      >
        {/* 4 Wooden Charpai Legs */}
        {[-0.85, 0.85].map((lx) =>
          [-0.42, 0.42].map((lz) => (
            <mesh key={`khat-leg-${lx}-${lz}`} position={[lx, 0.22, lz]} castShadow>
              <cylinderGeometry args={[0.04, 0.035, 0.44, 8]} />
              <meshStandardMaterial color="#5d4037" />
            </mesh>
          ))
        )}
        {/* Wooden Frame */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[1.85, 0.07, 0.95]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
        {/* Woven Rope Bed & Pillow */}
        <mesh position={[0, 0.44, 0]}>
          <boxGeometry args={[1.72, 0.03, 0.84]} />
          <meshStandardMaterial color="#d7ccc8" roughness={0.9} />
        </mesh>
        <mesh position={[-0.62, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.08, 0.45, 8, 10]} />
          <meshStandardMaterial color="#e53935" />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 1.25, 0]} fontSize={0.26} color="#b3e5fc" outlineWidth={0.03} outlineColor="#000000">
            🛏️ खाट / चारपाई (Sleep)
          </Text>
        </Float>
      </group>

      {/* Interactive Village Panchayat Rules Board (गाँव के नियम बोर्ड) */}
      <group
        position={[-6.2, 0, 2.2]}
        rotation={[0, 0.35, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenRules) onOpenRules();
        }}
      >
        {[-0.75, 0.75].map((px) => (
          <mesh key={`board-post-${px}`} position={[px, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 1.8, 8]} />
            <meshStandardMaterial color="#4e342e" />
          </mesh>
        ))}
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[1.8, 1.05, 0.1]} />
          <meshStandardMaterial color="#3e2723" />
        </mesh>
        <mesh position={[0, 1.35, 0.06]}>
          <boxGeometry args={[1.64, 0.88, 0.02]} />
          <meshStandardMaterial color="#fff8e1" />
        </mesh>
        <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
          <Text position={[0, 2.25, 0]} fontSize={0.26} color="#ffd54f" outlineWidth={0.03} outlineColor="#000000">
            📜 पंचायत नियम बोर्ड (Rules)
          </Text>
        </Float>
      </group>

      {/* 8. THE 7 DETAILED ANATOMICAL VILLAGERS (With Dynamic A* Pathfinding Around Placed Structures) */}
      {/* 1. Ramu Kaka (Sarpanch) */}
      <RealisticHuman
        npcId={1}
        position={{ x: -8, z: 2 }}
        patrolPoints={[
          { x: -5.2, z: 3.5 },
          { x: -3.5, z: -2.5 },
          { x: 4.2, z: -4.2 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={0.3}
        isNight={isNight}
        kurtaColor="#ffffff"
        dhotiColor="#f5f5f5"
        turbanColor="#ff9800"
        gamchhaColor="#e65100"
        hasMustache={true}
        mustacheColor="#e0e0e0"
        hasBeard={true}
        hasSpectacles={true}
        hasLathi={true}
        nameBadge="👴🏽 रामू काका"
        roleBadge="ग्राम प्रधान / सरपंच"
        onClick={() => onNPCClick(1)}
      />

      {/* 2. Lala Ji (Merchant) */}
      <RealisticHuman
        npcId={2}
        position={{ x: 9, z: 3.2 }}
        patrolPoints={[
          { x: 6.5, z: 3.2 },
          { x: 11.5, z: 3.2 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={-0.2}
        isNight={isNight}
        kurtaColor="#ffca28"
        dhotiColor="#fff8e1"
        turbanColor="#e91e63"
        hasMustache={true}
        hasSpectacles={true}
        hasLedger={true}
        nameBadge="👳🏽 लाला जी"
        roleBadge="मंडी व्यापारी"
        onClick={() => onNPCClick(2)}
      />

      {/* 3. Pandit Ji (Temple Pujari) */}
      <RealisticHuman
        npcId={3}
        position={{ x: 0, z: -10.5 }}
        patrolPoints={[
          { x: 3.8, z: -7.5 },
          { x: -2.8, z: -9.5 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={0}
        isNight={isNight}
        kurtaColor="#ff7043"
        dhotiColor="#fff3e0"
        turbanColor="#ffffff"
        hasMustache={true}
        hasBeard={true}
        mustacheColor="#eeeeee"
        nameBadge="🕉️ पंडित जी"
        roleBadge="मंदिर पुजारी"
        onClick={() => onNPCClick(3)}
      />

      {/* 4. Shanti Dadi (Grandmother in Green & Gold Zari Sari) */}
      <RealisticHuman
        npcId={4}
        position={{ x: -3.2, z: -5.2 }}
        patrolPoints={[
          { x: -5.5, z: -2.2 },
          { x: -1.5, z: -8.5 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={0.4}
        isNight={isNight}
        kurtaColor="#2e7d32"
        hasSari={true}
        hasMustache={false}
        hasSpectacles={true}
        nameBadge="👵🏽 शांति दादी"
        roleBadge="बुज़ुर्ग दादी"
        onClick={() => onNPCClick(4)}
      />

      {/* 5. Raju Chaiwala */}
      <RealisticHuman
        npcId={5}
        position={{ x: 12.2, z: 2.5 }}
        patrolPoints={[
          { x: 10.5, z: 3.5 },
          { x: 13.5, z: 4.2 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={-0.4}
        isNight={isNight}
        kurtaColor="#fff8e1"
        turbanColor="#d32f2f"
        gamchhaColor="#d32f2f"
        hasMustache={true}
        nameBadge="☕ राजू चायवाला"
        roleBadge="चाय की टपरी"
        onClick={() => onNPCClick(5)}
      />

      {/* 6. Driver Babu */}
      <RealisticHuman
        npcId={6}
        position={{ x: 5.5, z: 14 }}
        patrolPoints={[
          { x: -4.0, z: 14.2 },
          { x: 8.5, z: 13.5 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={-0.5}
        isNight={isNight}
        kurtaColor="#546e7a"
        dhotiColor="#37474f"
        hasCap={true}
        hasMustache={true}
        nameBadge="🚌 ड्राइवर बाबू"
        roleBadge="टेम्पो व बस चालक"
        onClick={() => onNPCClick(6)}
      />

      {/* 7. Chhotu (Village Schoolboy) */}
      <RealisticHuman
        npcId={7}
        position={{ x: -7.5, z: 8.5 }}
        patrolPoints={[
          { x: -4.5, z: 5.5 },
          { x: 3.5, z: 5.5 },
          { x: -6.8, z: 11.5 }
        ]}
        structures={structures}
        upgrades={upgrades}
        rotation={0.6}
        isNight={isNight}
        kurtaColor="#0288d1"
        dhotiColor="#e1f5fe"
        hasCap={true}
        hasMustache={false}
        scale={0.78}
        nameBadge="👦🏽 छोटू"
        roleBadge="गाँव का बालक"
        onClick={() => onNPCClick(7)}
      />
    </group>
  );
};

// ==========================================
// 9. FARM PLOTS (With Interactive 3D Action Prompts & Status Indicators)
// ==========================================

const WalkDestinationMarker: React.FC<{ target: { x: number; z: number } }> = ({ target }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.14;
      ringRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={[target.x, 0.03, target.z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.36, 24]} />
        <meshBasicMaterial color="#ffd54f" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#ffca28" transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

const RealisticFarmPlot: React.FC<{
  plot: Plot;
  onClick: (id: number) => void;
}> = ({ plot, onClick }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  let color = COLORS.SOIL_EMPTY;
  let height = 0.1;
  if (plot.state === LandState.PLOWED) {
    color = COLORS.SOIL_DRY;
    height = 0.15;
  } else if (plot.state === LandState.SEEDED) {
    color = COLORS.SOIL_WET;
    height = 0.15;
  } else if (plot.state === LandState.GROWING || plot.state === LandState.RIPE) {
    height = 0.15;
  }
  if (plot.waterLevel > 40) color = COLORS.SOIL_WET;

  const isRipe = plot.state === LandState.RIPE;
  const needsWater = (plot.state === LandState.GROWING || plot.state === LandState.SEEDED) && plot.waterLevel < 35;

  const getHoverPrompt = (): string => {
    if (plot.state === LandState.EMPTY) return '⛏️ टैप करें: खेत जोतें (Plow)';
    if (plot.state === LandState.PLOWED) return '🌱 टैप करें: बीज बोएं (Plant)';
    if (plot.state === LandState.RIPE) return '🌾 टैप करें: पकी फसल काटें! (Harvest)';
    const pct = Math.round(plot.growthProgress);
    return plot.waterLevel < 70
      ? `💧 टैप करें: सिंचाई करें (${pct}%)`
      : `🌿 फसल बढ़ रही है (${pct}%)`;
  };

  const renderCrop = () => {
    if (!plot.cropType || plot.state === LandState.EMPTY || plot.state === LandState.PLOWED) return null;
    const cropInfo = CROP_DATA[plot.cropType];
    const growthScale = Math.max(0.22, plot.growthProgress / 100);

    if (plot.cropType === CropType.MUSTARD) {
      return (
        <group position={[0, 0.1, 0]}>
          {[-0.35, 0, 0.35].map((ox, i) => (
            <group key={`mustard-${i}`} position={[ox, 0, (i - 1) * 0.25]}>
              <mesh position={[0, growthScale * 0.45, 0]} castShadow>
                <cylinderGeometry args={[0.03, 0.04, growthScale * 0.9, 8]} />
                <meshStandardMaterial color="#388e3c" />
              </mesh>
              <mesh position={[0, growthScale * 0.9, 0]} castShadow>
                <sphereGeometry args={[isRipe ? 0.18 : 0.09, 8, 8]} />
                <meshStandardMaterial color={isRipe ? '#ffd600' : '#8bc34a'} />
              </mesh>
            </group>
          ))}
        </group>
      );
    }

    if (plot.cropType === CropType.SUGARCANE) {
      const h = growthScale * 1.8;
      return (
        <group position={[0, 0.1, 0]}>
          {[-0.3, 0.3].map((ox, i) => (
            <group key={`cane-${i}`} position={[ox, 0, (i === 0 ? -0.2 : 0.2)]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.06, h, 8]} />
                <meshStandardMaterial color={isRipe ? '#2e7d32' : '#4caf50'} />
              </mesh>
              <mesh position={[0, h, 0]}>
                <coneGeometry args={[0.2 * growthScale, 0.4 * growthScale, 6]} />
                <meshStandardMaterial color="#81c784" />
              </mesh>
            </group>
          ))}
        </group>
      );
    }

    return (
      <group position={[0, 0.1, 0]}>
        {[-0.32, 0, 0.32].map((ox, i) => (
          <group key={`grain-${i}`} position={[ox, 0, (i - 1) * 0.25]}>
            <mesh position={[0, growthScale / 2, 0]} castShadow>
              <cylinderGeometry args={[0.05 * growthScale, 0.025, growthScale, 8]} />
              <meshStandardMaterial color={isRipe ? cropInfo.color : '#4caf50'} />
            </mesh>
            {isRipe && (
              <mesh position={[0, growthScale + 0.06, 0]}>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color={cropInfo.color} />
              </mesh>
            )}
          </group>
        ))}
      </group>
    );
  };

  return (
    <group position={[plot.x, 0, plot.z]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick(plot.id);
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        position={[0, height / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[PLOT_SIZE - 0.18, height, PLOT_SIZE - 0.18]} />
        <meshStandardMaterial
          color={hovered ? '#8d6e63' : color}
          roughness={0.88}
          emissive={hovered ? '#ffca28' : isRipe ? '#ffb300' : '#000000'}
          emissiveIntensity={hovered ? 0.18 : isRipe ? 0.1 : 0}
        />
      </mesh>

      {/* Plowed Soil Ridges for Visual Clarity */}
      {plot.state !== LandState.EMPTY && (
        <group position={[0, height + 0.01, 0]}>
          {[-0.5, 0, 0.5].map((rz, idx) => (
            <mesh key={`furrow-${idx}`} position={[0, 0, rz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, PLOT_SIZE - 0.4, 6]} />
              <meshStandardMaterial color={plot.waterLevel > 40 ? '#3e2723' : '#5d4037'} roughness={0.95} />
            </mesh>
          ))}
        </group>
      )}

      {/* Rich Organic Manure Mulch Granules when Fertilized */}
      {plot.fertilizer && (
        <group position={[0, height + 0.03, 0]}>
          {[-0.45, -0.15, 0.2, 0.48].map((mx, idx) => (
            <mesh key={`manure-dot-${idx}`} position={[mx, 0, (idx % 2 === 0 ? -0.32 : 0.32)]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial
                color={plot.fertilizerMultiplier && plot.fertilizerMultiplier >= 6 ? '#ffd600' : plot.fertilizerMultiplier && plot.fertilizerMultiplier >= 4 ? '#66bb6a' : '#4e342e'}
                emissive={plot.fertilizerMultiplier && plot.fertilizerMultiplier >= 4 ? '#33691e' : '#000000'}
                emissiveIntensity={0.4}
              />
            </mesh>
          ))}
        </group>
      )}

      {renderCrop()}

      {/* Fertilizer Speed Multiplier Badge */}
      {plot.fertilizer && plot.state === LandState.GROWING && !hovered && (
        <Text
          position={[0, 0.72, 0.45]}
          fontSize={0.14}
          color="#b2ff59"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`⚡ ${plot.fertilizerMultiplier || 2.5}x खाद`}
        </Text>
      )}

      {/* Floating Status Badges so the player always knows what to do */}
      {isRipe && !hovered && (
        <Float speed={3} rotationIntensity={0} floatIntensity={0.3}>
          <Text
            position={[0, 1.45, 0]}
            fontSize={0.2}
            color="#ffd54f"
            outlineWidth={0.025}
            outlineColor="#000000"
          >
            🌾 फसल काटें!
          </Text>
        </Float>
      )}

      {needsWater && !hovered && (
        <Float speed={2.5} rotationIntensity={0} floatIntensity={0.25}>
          <Text
            position={[0, 1.1, 0]}
            fontSize={0.17}
            color="#4fc3f7"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            💧 पानी दें
          </Text>
        </Float>
      )}

      {plot.state === LandState.PLOWED && !hovered && (
        <Text
          position={[0, 0.42, 0]}
          fontSize={0.15}
          color="#a5d6a7"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          🌱 बीज बोएं
        </Text>
      )}

      {hovered && (
        <Text
          position={[0, isRipe ? 1.65 : 1.15, 0]}
          fontSize={0.18}
          color="#fffde7"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {getHoverPrompt()}
        </Text>
      )}
    </group>
  );
};

// ==========================================
// 10. MAIN GAME SCENE
// ==========================================

const GameScene: React.FC<GameSceneProps> = ({
  gameState,
  onPlotClick,
  onAnimalClick,
  onNPCClick,
  onPlaneClick,
  onChulhaClick,
  onTempleClick,
  onWellClick,
  onShopClick,
  onTalabClick,
  onChaiClick,
  onTempoClick,
  onSleepClick,
  onOpenRules
}) => {
  const isNight = Boolean(gameState.isManualNight);
  const sunPosition = new THREE.Vector3();
  const effectiveSunHour = isNight ? 22 : 10.5;
  const phi = (effectiveSunHour / 24) * Math.PI * 2 - Math.PI / 2;
  const theta = Math.PI / 4;
  sunPosition.setFromSphericalCoords(100, phi, theta);
  const isRainy = gameState.weather === 'Rainy';

  return (
    <Canvas shadows camera={{ position: [12, 14, 14], fov: 45 }}>
      <SoftShadows size={10} samples={10} />

      {isRainy && <Rain />}
      {isRainy && <fog attach="fog" args={['#cfd8dc', 5, 35]} />}

      <Sky
        sunPosition={isNight ? [0, -10, 0] : sunPosition}
        turbidity={isRainy ? 10 : 8}
        rayleigh={isRainy ? 1 : 0.6}
        mieCoefficient={isRainy ? 0.1 : 0.005}
        mieDirectionalG={isRainy ? 0.1 : 0.8}
      />
      {isNight && <Stars radius={100} depth={50} count={4000} factor={4} saturation={0} fade speed={1} />}

      <ambientLight
        intensity={isNight ? 0.22 : isRainy ? 0.5 : 0.58}
        color={isNight ? '#90caf9' : isRainy ? '#b0c4de' : '#ffffff'}
      />
      <directionalLight
        position={isNight ? [5, 12, 5] : sunPosition}
        intensity={isNight ? 0.25 : isRainy ? 0.6 : 1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Village World Assembly */}
      <VillageAssembly
        isNight={isNight}
        structures={gameState.structures}
        upgrades={gameState.upgrades}
        onPlaneClick={onPlaneClick}
        onChulhaClick={onChulhaClick}
        onTempleClick={onTempleClick}
        onWellClick={onWellClick}
        onShopClick={onShopClick}
        onNPCClick={onNPCClick}
        onTalabClick={onTalabClick}
        onChaiClick={onChaiClick}
        onTempoClick={onTempoClick}
        onSleepClick={onSleepClick}
        onOpenRules={onOpenRules}
      />

      {/* Player-Built Structures */}
      {gameState.structures.map((structure) => (
        <BuiltStructureMesh key={structure.id} structure={structure} />
      ))}

      {/* Target Destination Ring where player tapped */}
      <WalkDestinationMarker target={gameState.playerPos} />

      {/* Sculpted Anatomical Player Character (Farmer) with Active Tool & A* Obstacle Avoidance */}
      <RealisticHuman
        position={gameState.playerPos}
        rotation={gameState.playerRotation}
        isPlayer={true}
        selectedTool={gameState.selectedTool}
        isNight={isNight}
        structures={gameState.structures}
        upgrades={gameState.upgrades}
        kurtaColor="#ffffff"
        dhotiColor="#f5f5f5"
        turbanColor={COLORS.TURBAN}
        gamchhaColor="#d32f2f"
        hasMustache={true}
      />

      {/* Farm Animals: Species-Specific Models with A* Pathfinding, Grazing, Pecking & Night Sleeping States */}
      {gameState.animals.map((animal) => {
        if (animal.type === AnimalType.CHICKEN) {
          return (
            <RealisticChicken
              key={animal.id}
              animal={animal}
              isNight={isNight}
              structures={gameState.structures}
              upgrades={gameState.upgrades}
              onClick={onAnimalClick}
            />
          );
        }
        if (animal.type === AnimalType.GOAT) {
          return (
            <RealisticGoat
              key={animal.id}
              animal={animal}
              isNight={isNight}
              structures={gameState.structures}
              upgrades={gameState.upgrades}
              onClick={onAnimalClick}
            />
          );
        }
        return (
          <RealisticCow
            key={animal.id}
            animal={animal}
            isNight={isNight}
            structures={gameState.structures}
            upgrades={gameState.upgrades}
            onClick={onAnimalClick}
          />
        );
      })}

      {/* Farm Plots Grid */}
      <group position={[0, 0, 0]}>
        {gameState.plots.map((plot) => (
          <RealisticFarmPlot
            key={plot.id}
            plot={plot}
            onClick={onPlotClick}
          />
        ))}
      </group>

      <OrbitControls
        target={[0, 0, 0]}
        enablePan={true}
        enableZoom={true}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={40}
      />
    </Canvas>
  );
};

export default GameScene;
