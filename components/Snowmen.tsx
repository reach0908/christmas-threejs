import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Snowman } from '../types';

interface SnowmenProps {
    snowmen: Snowman[];
    onHit: (id: number) => void;
}

const SnowmanItem: React.FC<{ snowman: Snowman, onHit: () => void }> = ({ snowman, onHit }) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const [hitFlash, setHitFlash] = useState(0);
    const wiggleOffset = useMemo(() => Math.random() * 100, []);

    useFrame((state) => {
        if (groupRef.current) {
            const time = state.clock.elapsedTime;
            
            // Idle Animation: Gentle wobble
            const wobble = Math.sin(time * 2 + wiggleOffset) * 0.05;
            groupRef.current.rotation.z = wobble;
            groupRef.current.rotation.x = Math.cos(time * 1.5 + wiggleOffset) * 0.03;

            // Hit Flash Animation
            if (hitFlash > 0) {
                const scale = 1 + Math.sin(hitFlash * Math.PI) * 0.2;
                groupRef.current.scale.set(scale, scale, scale);
                setHitFlash(prev => Math.max(0, prev - 0.1));
            } else {
                // Hover scale
                const targetScale = hovered ? 1.1 : 1.0;
                groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
            }
        }
    });

    const handleClick = (e: any) => {
        e.stopPropagation();
        setHitFlash(1);
        onHit();
    };

    const snowMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1, // Look like snow
        metalness: 0
    }), []);

    const coalMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }), []);
    const carrotMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.5 }), []);
    const stickMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 }), []);
    const scarfMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.8 }), []);

    return (
        <group 
            ref={groupRef}
            position={snowman.position} 
            rotation={[0, snowman.rotation, 0]}
            onClick={handleClick}
            onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
             {/* --- Body --- */}
             {/* Bottom Sphere */}
             <mesh position={[0, 0.6, 0]} castShadow receiveShadow material={snowMaterial}>
                 <sphereGeometry args={[0.7, 16, 16]} />
             </mesh>
             {/* Middle Sphere */}
             <mesh position={[0, 1.6, 0]} castShadow receiveShadow material={snowMaterial}>
                 <sphereGeometry args={[0.55, 16, 16]} />
             </mesh>
             {/* Head Sphere */}
             <mesh position={[0, 2.4, 0]} castShadow receiveShadow material={snowMaterial}>
                 <sphereGeometry args={[0.4, 16, 16]} />
             </mesh>

             {/* --- Face --- */}
             {/* Eyes */}
             <mesh position={[0.15, 2.5, 0.3]} material={coalMaterial}>
                 <sphereGeometry args={[0.05]} />
             </mesh>
             <mesh position={[-0.15, 2.5, 0.3]} material={coalMaterial}>
                 <sphereGeometry args={[0.05]} />
             </mesh>
             {/* Nose */}
             <mesh position={[0, 2.4, 0.4]} rotation={[Math.PI/2, 0, 0]} material={carrotMaterial}>
                 <coneGeometry args={[0.06, 0.3, 8]} />
             </mesh>
             {/* Buttons */}
             <mesh position={[0, 1.8, 0.5]} material={coalMaterial}>
                 <sphereGeometry args={[0.05]} />
             </mesh>
             <mesh position={[0, 1.6, 0.53]} material={coalMaterial}>
                 <sphereGeometry args={[0.05]} />
             </mesh>
             <mesh position={[0, 1.4, 0.5]} material={coalMaterial}>
                 <sphereGeometry args={[0.05]} />
             </mesh>

             {/* --- Accessories --- */}
             {/* Hat (Cylinder) */}
             <group position={[0, 2.75, 0]} rotation={[-0.1, 0, 0.1]}>
                <mesh castShadow material={coalMaterial}>
                    <cylinderGeometry args={[0.3, 0.3, 0.5]} />
                </mesh>
                <mesh position={[0, -0.25, 0]} castShadow material={coalMaterial}>
                    <cylinderGeometry args={[0.5, 0.5, 0.05]} />
                </mesh>
                <mesh position={[0, -0.1, 0]}>
                     <cylinderGeometry args={[0.31, 0.31, 0.1]} />
                     <meshStandardMaterial color="#ff0000" />
                </mesh>
             </group>

             {/* Scarf (Torus) */}
             <mesh position={[0, 2.05, 0]} rotation={[Math.PI/2, 0, 0]} material={scarfMaterial}>
                 <torusGeometry args={[0.35, 0.1, 8, 16]} />
             </mesh>
             <mesh position={[0.2, 1.8, 0.3]} rotation={[0, 0, -0.2]} material={scarfMaterial}>
                 <boxGeometry args={[0.15, 0.5, 0.05]} />
             </mesh>

             {/* Arms (Sticks) */}
             <mesh position={[0.5, 1.7, 0]} rotation={[0, 0, -0.5]} castShadow material={stickMaterial}>
                 <cylinderGeometry args={[0.03, 0.03, 0.8]} />
             </mesh>
             <mesh position={[-0.5, 1.7, 0]} rotation={[0, 0, 0.5]} castShadow material={stickMaterial}>
                 <cylinderGeometry args={[0.03, 0.03, 0.8]} />
             </mesh>

             {/* Health Bar (Only show if damaged) */}
             {snowman.hp < 3 && (
                 <mesh position={[0, 3.5, 0]}>
                     <boxGeometry args={[1, 0.1, 0.05]} />
                     <meshBasicMaterial color="red" />
                     <mesh position={[-(1 - snowman.hp/3)/2, 0, 0.01]}>
                        <boxGeometry args={[snowman.hp/3, 0.1, 0.05]} />
                        <meshBasicMaterial color="green" />
                     </mesh>
                 </mesh>
             )}
        </group>
    );
};

// Explosion effect when snowman dies
const SnowExplosion: React.FC<{ position: [number, number, number] }> = ({ position }) => {
    const groupRef = useRef<THREE.Group>(null);
    const [finished, setFinished] = useState(false);

    useFrame((state, delta) => {
        if (groupRef.current && !finished) {
            groupRef.current.children.forEach((child: any) => {
                 child.position.add(child.userData.velocity);
                 child.userData.velocity.y -= delta * 5; // Gravity
                 child.scale.multiplyScalar(0.95); // Shrink
            });
            
            // Cleanup check
            if (groupRef.current.children[0].scale.x < 0.01) {
                setFinished(true);
            }
        }
    });

    // Create particles once
    const particles = useMemo(() => {
        return [...Array(12)].map((_, i) => ({
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 0.3
            )
        }));
    }, []);

    if (finished) return null;

    return (
        <group ref={groupRef} position={position}>
            {particles.map((p, i) => (
                <mesh key={i} userData={{ velocity: p.velocity }}>
                    <boxGeometry args={[0.3, 0.3, 0.3]} />
                    <meshStandardMaterial color="white" />
                </mesh>
            ))}
        </group>
    );
};


export const Snowmen: React.FC<SnowmenProps> = ({ snowmen, onHit }) => {
    // We also want to render explosions for recently dead snowmen
    // But for simplicity in this React model, we can rely on the Gift spawning logic to indicate success
    // or we can add a transient effect. Let's just handle living snowmen here.

    return (
        <group>
            {snowmen.map(sm => (
                !sm.isDead && <SnowmanItem key={sm.id} snowman={sm} onHit={() => onHit(sm.id)} />
            ))}
            {/* Transient explosions could be managed here if state allows, 
                but simply removing the snowman instantly is also fine, 
                maybe add a particle effect on the Gift spawn instead? 
                Let's stick to simple removal + gift appearance. */}
        </group>
    );
};