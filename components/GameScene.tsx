import React, { useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { VoxelWorld, SnowParticles } from './VoxelAssets';
import { Collectibles } from './Collectibles';
import { Snowmen } from './Snowmen';
import { Gift, Snowman } from '../types';

interface GameSceneProps {
    gifts: Gift[];
    snowmen: Snowman[];
    onCollect: (id: number) => void;
    onSnowmanHit: (id: number) => void;
}

// CameraRig now accepts controlsRef to ensure it accesses the correct instance
const CameraRig = ({ controlsRef }: { controlsRef: React.RefObject<any> }) => {
    const { camera } = useThree();
    const [, get] = useKeyboardControls();
    
    useFrame((state, delta) => {
        const controls = controlsRef.current;
        if (!controls) return;
        
        const { forward, backward, left, right } = get();
        if (!forward && !backward && !left && !right) return;

        const speed = 40 * delta; // Increased speed
        
        // Calculate camera forward direction (projected on XZ plane)
        const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forwardDir.y = 0;
        forwardDir.normalize();
        
        // Calculate camera right direction
        const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        rightDir.y = 0;
        rightDir.normalize();
        
        const moveDir = new THREE.Vector3();
        
        if (forward) moveDir.add(forwardDir);
        if (backward) moveDir.sub(forwardDir);
        if (right) moveDir.add(rightDir);
        if (left) moveDir.sub(rightDir);
        
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().multiplyScalar(speed);
            camera.position.add(moveDir);
            controls.target.add(moveDir);
        }
    });
    return null;
};

export const GameScene: React.FC<GameSceneProps> = ({ gifts, snowmen, onCollect, onSnowmanHit }) => {
    const controlsRef = useRef<any>(null);

    // Calculate Environment Config based on Local Time
    const config = useMemo(() => {
        const hour = new Date().getHours();
        
        // Night (20:00 - 05:00)
        if (hour >= 20 || hour < 5) {
            return {
                bg: '#150a15',
                fogColor: '#150a15',
                fogNear: 30, fogFar: 90,
                ambientSky: '#2a1a3a', ambientGround: '#110500', ambientInt: 0.2,
                dirColor: '#d0e0ff', dirInt: 0.4, dirPos: [-60, 80, -40], // Moon
                starOpacity: 1.0,
                isNight: true,
                bloomThreshold: 1.0
            };
        }
        // Sunrise (05:00 - 08:00)
        if (hour >= 5 && hour < 8) {
            return {
                bg: '#ffcc99', // Peach
                fogColor: '#ffcc99',
                fogNear: 20, fogFar: 80,
                ambientSky: '#ffddaa', ambientGround: '#443322', ambientInt: 0.5,
                dirColor: '#ffaa00', dirInt: 0.6, dirPos: [60, 20, -40], // Low Sun
                starOpacity: 0.0,
                isNight: false, // Lamps off
                bloomThreshold: 2.0
            };
        }
        // Day (08:00 - 16:00)
        if (hour >= 8 && hour < 16) {
            return {
                bg: '#87CEEB', // Sky Blue
                fogColor: '#aaccff',
                fogNear: 40, fogFar: 120,
                ambientSky: '#ffffff', ambientGround: '#ccccff', ambientInt: 0.7,
                dirColor: '#ffffff', dirInt: 1.2, dirPos: [20, 100, 20], // High Sun
                starOpacity: 0.0,
                isNight: false,
                bloomThreshold: 3.0 // Effectively no bloom
            };
        }
        // Sunset (16:00 - 18:00)
        if (hour >= 16 && hour < 18) {
            return {
                bg: '#ffccb3', // Soft Peach
                fogColor: '#ffccb3',
                fogNear: 20, fogFar: 90,
                ambientSky: '#eec0c8', // Soft Pink
                ambientGround: '#5e4b5e', // Deep warm purple
                ambientInt: 0.6,
                dirColor: '#ffeebb', // Golden light
                dirInt: 0.9, dirPos: [-60, 20, 40], // Low Sun
                starOpacity: 0.2,
                isNight: false, 
                bloomThreshold: 1.5
            };
        }
        // Evening (18:00 - 20:00)
        return {
            bg: '#2c1e31', // Deep Purple
            fogColor: '#2c1e31',
            fogNear: 30, fogFar: 90,
            ambientSky: '#4a3a5a', ambientGround: '#221122', ambientInt: 0.3,
            dirColor: '#aaaaff', dirInt: 0.3, dirPos: [-60, 60, -40], // Moon rising
            starOpacity: 0.8,
            isNight: true, // Lamps on
            bloomThreshold: 1.0
        };
    }, []);

    // Helper to cast array to vector tuple for TS
    const dirPos = config.dirPos as [number, number, number];

    const keyboardMap = useMemo(() => [
        { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
        { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
        { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
        { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
    ], []);

  return (
    <KeyboardControls map={keyboardMap}>
        <Canvas shadows camera={{ fov: 40, position: [-50, 20, 50], near: 0.5 }} dpr={[1, 1.5]}>
        {/* --- Environment --- */}
        <color attach="background" args={[config.bg]} />
        <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} opacity={config.starOpacity} />

        {/* --- Lighting --- */}
        <hemisphereLight intensity={config.ambientInt} groundColor={config.ambientGround} color={config.ambientSky} />
        
        {/* Main Directional Light (Sun/Moon) */}
        <directionalLight 
            position={dirPos} 
            intensity={config.dirInt} 
            color={config.dirColor} 
            castShadow 
            shadow-mapSize={[1024, 1024]} 
            shadow-bias={-0.0001}
        >
            <orthographicCamera attach="shadow-camera" args={[-60, 60, 60, -60]} />
        </directionalLight>

        {/* Warm Point Light - Only active at night or evening to illuminate the tree area */}
        {config.isNight && (
            <pointLight 
                position={[0, 15, 0]} 
                intensity={2.0} 
                distance={70} 
                color="#ffaa44" 
                decay={2} 
            />
        )}

        {/* --- Voxel World --- */}
        <VoxelWorld isNight={config.isNight} />
        <SnowParticles />

        {/* --- Gameplay --- */}
        <Snowmen snowmen={snowmen} onHit={onSnowmanHit} />
        <Collectibles gifts={gifts} onCollect={onCollect} />

        {/* --- Post Processing --- */}
        <EffectComposer disableNormalPass>
            <Bloom 
                luminanceThreshold={config.bloomThreshold} 
                mipmapBlur 
                intensity={0.8}
                radius={0.6}
                levels={6} 
            />
        </EffectComposer>

        {/* --- Controls --- */}
        <CameraRig controlsRef={controlsRef} />
        <OrbitControls 
            ref={controlsRef}
            makeDefault
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            enableDamping={true}
            dampingFactor={0.1}
            
            // Allow getting very close to enter houses
            minDistance={2} 
            maxDistance={110} 
            maxPolarAngle={Math.PI / 2} // Allow looking straight forward
            
            mouseButtons={{
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE
            }}
            touches={{
                ONE: THREE.TOUCH.PAN,
                TWO: THREE.TOUCH.DOLLY_ROTATE
            }}
            
            screenSpacePanning={false} // Better for walking around
            target={[0, 5, 0]} 
        />
        </Canvas>
    </KeyboardControls>
  );
};