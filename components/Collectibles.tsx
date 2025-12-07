import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Gift, GiftType } from '../types';

interface CollectiblesProps {
  gifts: Gift[];
  onCollect: (id: number) => void;
}

export const Collectibles: React.FC<CollectiblesProps> = ({ gifts, onCollect }) => {
  return (
    <group>
      {gifts.map((gift) => (
        !gift.collected && <GiftItem key={gift.id} gift={gift} onClick={() => onCollect(gift.id)} />
      ))}
    </group>
  );
};

// --- Asset Geometries ---

const BoxAsset = ({ color }: { color: string }) => (
    <group>
        <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} emissive={color} emissiveIntensity={0.4} />
        </mesh>
        {/* Ribbon */}
        <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.72, 0.72, 0.2]} />
            <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.2, 0.72, 0.72]} />
            <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} />
        </mesh>
    </group>
);

const CandyCaneAsset = () => (
    <group>
         {/* Main stick */}
        <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
            <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} />
        </mesh>
        {/* Stripes (Torus loops acting as stripes) */}
        {[...Array(4)].map((_, i) => (
             <mesh key={i} position={[0, -0.3 + i*0.25, 0]} rotation={[0.5, 0, 0]}>
                <torusGeometry args={[0.11, 0.04, 6, 12]} />
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
             </mesh>
        ))}
        {/* Hook */}
        <mesh position={[0.2, 0.5, 0]} rotation={[0, 0, -Math.PI/2]}>
            <torusGeometry args={[0.2, 0.1, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
    </group>
);

const OrnamentAsset = ({ color }: { color: string }) => (
    <group>
        <mesh castShadow>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color={color} roughness={0.1} metalness={0.8} emissive={color} emissiveIntensity={0.6} />
        </mesh>
        {/* Cap */}
        <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.15, 8]} />
            <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.2} />
        </mesh>
    </group>
);

const StockingAsset = () => (
    <group scale={0.8}>
        {/* Leg */}
        <mesh position={[0, 0.2, 0]} castShadow>
             <boxGeometry args={[0.3, 0.7, 0.3]} />
             <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
        {/* Foot */}
        <mesh position={[0.2, -0.15, 0]}>
             <boxGeometry args={[0.5, 0.3, 0.35]} />
             <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
        {/* Cuff */}
        <mesh position={[0, 0.6, 0]}>
             <boxGeometry args={[0.4, 0.2, 0.4]} />
             <meshStandardMaterial color="white" roughness={1} />
        </mesh>
    </group>
);

const GingerbreadAsset = () => (
    <group scale={0.7}>
        {/* Body */}
        <mesh castShadow>
            <boxGeometry args={[0.5, 0.6, 0.15]} />
            <meshStandardMaterial color="#8d6e63" roughness={1} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshStandardMaterial color="#8d6e63" roughness={1} />
        </mesh>
        {/* Arms */}
        <mesh position={[0.4, 0.1, 0]}>
            <boxGeometry args={[0.3, 0.15, 0.1]} />
            <meshStandardMaterial color="#8d6e63" />
        </mesh>
        <mesh position={[-0.4, 0.1, 0]}>
            <boxGeometry args={[0.3, 0.15, 0.1]} />
            <meshStandardMaterial color="#8d6e63" />
        </mesh>
        {/* Legs */}
        <mesh position={[0.15, -0.4, 0]}>
            <boxGeometry args={[0.15, 0.3, 0.1]} />
            <meshStandardMaterial color="#8d6e63" />
        </mesh>
        <mesh position={[-0.15, -0.4, 0]}>
            <boxGeometry args={[0.15, 0.3, 0.1]} />
            <meshStandardMaterial color="#8d6e63" />
        </mesh>
        {/* Buttons */}
        <mesh position={[0, 0.1, 0.08]}>
            <sphereGeometry args={[0.04]} />
            <meshStandardMaterial color="red" />
        </mesh>
        <mesh position={[0, -0.1, 0.08]}>
            <sphereGeometry args={[0.04]} />
            <meshStandardMaterial color="green" />
        </mesh>
    </group>
);

const StarAsset = () => (
    <group>
        <mesh castShadow>
            <octahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.8} metalness={0.8} />
        </mesh>
    </group>
);


const GiftItem: React.FC<{ gift: Gift, onClick: () => void }> = ({ gift, onClick }) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    
    // Add randomness to animation speed
    const speedOffset = useMemo(() => Math.random() * 2, []);

    useFrame((state) => {
        if (groupRef.current) {
            // Floating animation
            groupRef.current.position.y = gift.position[1] + Math.sin(state.clock.elapsedTime * 2 + gift.id) * 0.2;
            // Rotation animation
            groupRef.current.rotation.y += 0.015 + (hovered ? 0.05 : 0);
            
            // Hover scale
            const targetScale = hovered ? 1.3 : 1.0;
            groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        }
    });

    const renderAsset = () => {
        switch(gift.type) {
            case 'cane': return <CandyCaneAsset />;
            case 'ornament': return <OrnamentAsset color={gift.color} />;
            case 'stocking': return <StockingAsset />;
            case 'gingerbread': return <GingerbreadAsset />;
            case 'star': return <StarAsset />;
            case 'box':
            default: return <BoxAsset color={gift.color} />;
        }
    };

    return (
        <group 
            ref={groupRef} 
            position={[gift.position[0], gift.position[1], gift.position[2]]}
            rotation={gift.rotation ? [gift.rotation[0], gift.rotation[1], gift.rotation[2]] : [0,0,0]}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
            {/* Invisible Hitbox for easier clicking */}
            <mesh visible={false}>
                <sphereGeometry args={[1]} />
            </mesh>
            
            {/* The Asset */}
            {renderAsset()}

            {/* Sparkle Effect if hovered */}
            {hovered && (
                 <pointLight distance={3} intensity={2} color="white" />
            )}
        </group>
    );
};