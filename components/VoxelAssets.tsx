import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// --- Configuration ---
const VOXEL_SIZE = 0.25;
const WORLD_RADIUS = 90;

// --- Palette ---
const PALETTE = {
    // Environment
    SNOW: 0xffffff,
    SNOW_SHADOW: 0xe6e6fa,
    DIRT: 0x4a3c31,
    STONE: 0x666666,
    PATH: 0xcabba0,
    ICE: 0xa5f2f3, // Default Ice Surface
    ICE_DEEP: 0x224466, // Dark Clear Ice
    ICE_CRACK: 0xffffff, // White Crushed Ice
    WATER: 0x0a1a2a, // Very Dark Abyss Water
    
    // Buildings (Brick & Wood)
    BRICK_MAIN: 0xb94e48, 
    BRICK_DARK: 0x8f332d, 
    ROOF_SLATE: 0x2d3436, 
    WOOD_TRUNK: 0x2e1e14,
    WOOD_PLANKS: 0x5d4037,
    DOOR_WOOD: 0x4a3222, 
    DOOR_HANDLE: 0xffd700, 
    
    // Tree & Foliage
    LEAF_DARK: 0x0f2e13,
    LEAF_LIGHT: 0x1f4523,
    LEAF_SNOWY: 0x5c7a60,
    
    // Decor
    DECOR_RED: 0xe60026,
    DECOR_GOLD: 0xffd700,
    DECOR_SILVER: 0xe0e0e0,
    DECOR_ROYAL_BLUE: 0x0047ab,
    DECOR_PURPLE: 0x800080,
    DECOR_PINK: 0xff1493,
    
    // Lights
    LIGHT_STRING: 0xffaa00,
    LIGHT_WARM: 0xffcf48,
    STAR_CORE: 0xffcc00,
    STAR_GLOW: 0xff9900,
    LAMP_WARM: 0xffaa44, 
    LAMP_POST: 0x1a1a1a, 
};

// --- Helper Types ---
type VoxelData = { x: number, y: number, z: number, color: number };
type Point3 = { x: number, y: number, z: number };
type DoorData = { position: [number, number, number], rotation: number };

// --- Procedural Generation Logic ---
const generateWorld = () => {
    const regularVoxels: VoxelData[] = [];
    const glowingVoxels: VoxelData[] = [];
    const interactiveIce: VoxelData[] = []; 
    const waterVoxels: VoxelData[] = []; 
    const lampCoords: Point3[] = []; 
    const doors: DoorData[] = []; 
    const occupied = new Set<string>(); 
    const pathHeightMap = new Map<string, number>();
    
    const add = (x: number, y: number, z: number, color: number, isGlowing: boolean = false) => {
        const vx = Math.round(x);
        const vy = Math.round(y);
        const vz = Math.round(z);
        
        const key = `${vx},${vy},${vz}`;
        if (occupied.has(key)) return;
        occupied.add(key);
        
        if (isGlowing) glowingVoxels.push({ x: vx, y: vy, z: vz, color });
        else regularVoxels.push({ x: vx, y: vy, z: vz, color });
    };

    // --- Path Generation Helper ---
    const createPath = (x1: number, z1: number, x2: number, z2: number, widthOverride: number = 1.5) => {
        const dist = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
        const steps = Math.ceil(dist * 2); 
        
        for(let i=0; i<=steps; i++) {
            const t = i/steps;
            const cx = x1 + (x2-x1)*t;
            const cz = z1 + (z2-z1)*t;
            
            for(let ox=-widthOverride; ox<=widthOverride; ox+=0.5) {
                for(let oz=-widthOverride; oz<=widthOverride; oz+=0.5) {
                    const px = Math.round(cx + ox);
                    const pz = Math.round(cz + oz);
                    pathHeightMap.set(`${px},${pz}`, 0); 
                }
            }
        }

        if (dist > 10) {
            const lampSpacing = 25; 
            const numLamps = Math.floor(dist / lampSpacing);
            for(let i=1; i<numLamps; i++) {
                const t = i/numLamps;
                const lx = x1 + (x2-x1)*t;
                const lz = z1 + (z2-z1)*t;
                const offset = 2.5; 
                const side = (i % 2 === 0) ? 1 : -1;
                const lampX = Math.round(lx + (Math.random() * 0.5)); 
                const lampZ = Math.round(lz + side * offset);
                buildLamp(lampX, 0, lampZ);
            }
        }
    };

    const buildLamp = (x: number, y: number, z: number) => {
        const poleHeight = 9;
        for(let h=0; h<poleHeight; h++) add(x, y+h, z, PALETTE.LAMP_POST);
        const armY = y + poleHeight - 1;
        add(x, armY, z, PALETTE.LAMP_POST);
        add(x, armY+0.5, z, PALETTE.LAMP_POST); 
        const lightY = armY - 0.5;
        add(x, lightY, z+0.6, PALETTE.LAMP_POST); 
        add(x, lightY, z-0.6, PALETTE.LAMP_POST);
        add(x+0.6, lightY, z, PALETTE.LAMP_POST);
        add(x-0.6, lightY, z, PALETTE.LAMP_POST);
        add(x, lightY, z, PALETTE.LAMP_WARM, true);
        lampCoords.push({ x: x * VOXEL_SIZE, y: (lightY - 1) * VOXEL_SIZE, z: z * VOXEL_SIZE });
    };

    // --- Houses ---
    const buildHouse = (cx: number, cz: number, width: number, depth: number, height: number, rotation: number = 0) => {
        const rotate = (x: number, z: number) => {
            if (rotation === 0) return { x: cx + x, z: cz + z };
            return { x: cx - z, z: cz + x };
        };

        const groundY = 0;
        let doorRecorded = false;

        for (let y = 0; y < height + 8; y++) {
            for (let x = -width/2; x <= width/2; x++) {
                for (let z = -depth/2; z <= depth/2; z++) {
                    const pos = rotate(x, z);
                    
                    if (y < height) {
                        // Create walls (shell only)
                        if (Math.abs(x) >= width/2 - 1 || Math.abs(z) >= depth/2 - 1) {
                            const isFront = Math.abs(z - depth/2) < 1.5;
                            const isDoorX = x >= -2 && x <= 1;
                            const isDoorY = y < 7;
                            
                            // Create Door Gap
                            if (isFront && isDoorX && isDoorY) {
                                if (!doorRecorded && x === -2 && y === 0) {
                                    const hingePos = rotate(-2.5, depth/2); 
                                    const doorRot = rotation === 0 ? 0 : -Math.PI / 2;
                                    doors.push({
                                        position: [hingePos.x * VOXEL_SIZE, groundY * VOXEL_SIZE, hingePos.z * VOXEL_SIZE],
                                        rotation: doorRot
                                    });
                                    doorRecorded = true;
                                }
                                continue; 
                            }

                            const isDarkBrick = (Math.abs(x*3 + y*2 + z) % 7 < 2) || Math.random() > 0.8;
                            let col = isDarkBrick ? PALETTE.BRICK_DARK : PALETTE.BRICK_MAIN;
                            const isWindowH = (y > 3 && y < 7) || (y > height - 6 && y < height - 2);
                            const isWindowX = Math.abs(x) < 2 || (width > 10 && Math.abs(Math.abs(x) - width/4) < 2);
                            if (isFront && isWindowH && isWindowX) {
                                add(pos.x, groundY + y, pos.z, PALETTE.LIGHT_WARM, true);
                            } else {
                                add(pos.x, groundY + y, pos.z, col);
                            }
                        } else if (y === 0) {
                            // Floor
                            add(pos.x, groundY + y, pos.z, PALETTE.WOOD_PLANKS);
                        }
                    } else {
                        // Roof
                        const roofY = y - height;
                        const roofScale = 1 - (roofY / 8); 
                        if (Math.abs(x) <= (width/2 + 1) * roofScale && Math.abs(z) <= (depth/2 + 1)) {
                            const isSnowTop = roofY > 6 || Math.random() > 0.7;
                            add(pos.x, groundY + y, pos.z, isSnowTop ? PALETTE.SNOW : PALETTE.ROOF_SLATE);
                        }
                    }
                }
            }
        }
        
        // Chimney
        const chimneyX = width/3;
        const chimneyZ = 0;
        for (let y = height/2; y < height + 10; y++) {
            for(let cx_ = -1; cx_<=1; cx_++) {
                for(let cz_ = -1; cz_<=1; cz_++) {
                    const pos = rotate(chimneyX + cx_, chimneyZ + cz_);
                    const isSmoke = y > height + 8;
                    if (isSmoke) {
                        if (Math.random() > 0.5 && cx_ === 0 && cz_ === 0) 
                             add(pos.x, groundY + y + Math.random()*2, pos.z, 0xaaaaaa); 
                    } else {
                         add(pos.x, groundY + y, pos.z, PALETTE.BRICK_DARK);
                    }
                }
            }
        }
    };

    const buildings = [
        { x: 50, z: 0, w: 12, d: 16, h: 12, r: 1 },
        { x: 30, z: -50, w: 10, d: 12, h: 10, r: 0 },
        { x: -40, z: -40, w: 14, d: 10, h: 14, r: 1 },
        { x: 0, z: 60, w: 16, d: 12, h: 11, r: 1 },
    ];

    // Generate paths for buildings
    buildings.forEach(b => {
        createPath(0, 0, b.x, b.z);
        if (b.r === 0) {
            const doorZ = b.z + b.d/2;
            createPath(b.x, doorZ, b.x, doorZ + 4, 3); 
        } else {
            const doorX = b.x - b.d/2;
            createPath(doorX, b.z, doorX - 4, b.z, 3);
        }
    });

    createPath(0, 0, -35, 35); 
    createPath(buildings[0].x, buildings[0].z, buildings[1].x, buildings[1].z);
    createPath(buildings[1].x, buildings[1].z, buildings[2].x, buildings[2].z);
    createPath(buildings[2].x, buildings[2].z, -35, 35); 
    createPath(-35, 35, buildings[3].x, buildings[3].z); 
    createPath(buildings[3].x, buildings[3].z, buildings[0].x, buildings[0].z);

    // --- GENERATE HOUSES ---
    buildings.forEach(b => {
        buildHouse(b.x, b.z, b.w, b.d, b.h, b.r);
    });

    // --- Terrain Generation ---
    const pondCenter = { x: -35, z: 35 };
    const pondRadius = 18;
    const ISLAND_DEPTH_CENTER = 45; // Increased depth to accommodate deep pond

    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
        for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
            const distSq = x * x + z * z;
            const dist = Math.sqrt(distSq);
            if (dist > WORLD_RADIUS) continue;
            
            const pathKey = `${Math.round(x)},${Math.round(z)}`;
            const isPath = pathHeightMap.has(pathKey);
            
            let surfaceY = 0;
            let surfaceColor = PALETTE.SNOW;
            const distToPond = Math.sqrt((x - pondCenter.x)**2 + (z - pondCenter.z)**2);
            const isPond = distToPond < pondRadius;
            let isIceSurface = false;

            // POND LOGIC
            const pondIceY = -2;
            const pondWaterY = -6;

            if (isPond) {
                // If we are strictly inside the pond area
                if (distToPond < pondRadius - 2) {
                    isIceSurface = true;
                    surfaceY = pondIceY;
                } else {
                    // Pond Rim
                    surfaceY = -1; 
                    surfaceColor = PALETTE.DIRT;
                }
            } else if (isPath) {
                surfaceY = 0;
                surfaceColor = PALETTE.PATH;
            } else {
                const terrainNoise = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 6 + Math.sin(x*0.1 + z*0.2)*2;
                surfaceY = Math.floor(terrainNoise);
                if (Math.random() > 0.7 && surfaceY > 2) {
                    surfaceColor = PALETTE.SNOW_SHADOW;
                }
            }

            const d = dist / WORLD_RADIUS;
            const bottomNoise = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 4 + Math.cos(x*0.3)*2;
            const structuralDepth = ISLAND_DEPTH_CENTER * (1 - Math.pow(d, 1.8));
            const totalDepth = Math.max(5, structuralDepth + bottomNoise);
            const bottomY = Math.floor(surfaceY - totalDepth);

            for (let y = bottomY; y <= surfaceY; y++) {
                const depthFromSurface = surfaceY - y;
                const heightFromBottom = y - bottomY;
                
                // --- POND / PIT LOGIC ---
                // If this (x,z) column is part of the ice surface
                if (isIceSurface) {
                    // 1. Ice Layer (Top)
                    if (y === pondIceY) {
                         interactiveIce.push({ x, y, z, color: PALETTE.ICE });
                         continue;
                    }
                    // 2. Air Gap (Between Ice and Water) - Skip generation
                    if (y < pondIceY && y > pondWaterY) {
                        continue; 
                    }
                    // 3. Water Layer (Bottom)
                    if (y === pondWaterY) {
                        waterVoxels.push({ x, y, z, color: PALETTE.WATER });
                        continue;
                    }
                    // 4. Below Water (Lake Bed)
                    if (y < pondWaterY) {
                        // Just standard stone/dirt bottom
                        if (y === pondWaterY - 1) add(x, y, z, PALETTE.DIRT);
                        else if (heightFromBottom < 2) add(x, y, z, PALETTE.STONE);
                    }
                    continue; // Skip the rest of the loop for this column
                }

                // --- NORMAL TERRAIN LOGIC ---
                const isCrust = depthFromSurface <= 7; 
                const isBottom = heightFromBottom <= 2;

                if (isCrust || isBottom) {
                    let color = PALETTE.STONE;
                    if (y === surfaceY) {
                         color = surfaceColor;
                    } else if (depthFromSurface <= 2 && !isPath) {
                        color = PALETTE.DIRT;
                    } else {
                        color = PALETTE.STONE;
                        if (Math.random() > 0.85) color = PALETTE.DIRT;
                    }
                    add(x, y, z, color);
                }
            }
        }
    }

    // --- Tree & Decor ---
    const treeBaseY = 0;
    const treeHeight = 100;
    const maxRadius = 32;

    for (let y = 0; y < treeHeight * 0.25; y++) {
        const trunkR = Math.max(2, 4 - y * 0.05);
        for (let x = -trunkR; x <= trunkR; x++) {
            for (let z = -trunkR; z <= trunkR; z++) {
                if (x*x + z*z <= trunkR*trunkR) {
                    add(x, treeBaseY + y, z, PALETTE.WOOD_TRUNK);
                }
            }
        }
    }

    for (let y = 8; y < treeHeight; y++) {
        const progress = y / treeHeight;
        const currentRadius = maxRadius * (1 - progress) + (Math.sin(y * 0.5) * 1.5);
        
        for (let x = -Math.ceil(currentRadius); x <= Math.ceil(currentRadius); x++) {
            for (let z = -Math.ceil(currentRadius); z <= Math.ceil(currentRadius); z++) {
                const distSq = x*x + z*z;
                if (distSq <= currentRadius * currentRadius) {
                    const isSurface = distSq > (currentRadius - 3) * (currentRadius - 3);
                    if (isSurface || Math.random() > 0.85) {
                        const worldY = treeBaseY + y;
                        let col = PALETTE.LEAF_DARK;
                        if (Math.random() > 0.7) col = PALETTE.LEAF_LIGHT;
                        if (y % 15 > 12) col = PALETTE.LEAF_SNOWY;

                        let isGlowing = false;
                        if (isSurface) {
                            const angle = Math.atan2(z, x);
                            const spiral1 = (angle * 5 + y * 0.25) % (Math.PI * 2);
                            const spiral2 = (angle * 5 + y * 0.25 + Math.PI) % (Math.PI * 2);

                            if (Math.abs(spiral1) < 0.3 || Math.abs(spiral2) < 0.3) {
                                col = PALETTE.LIGHT_STRING;
                                isGlowing = true;
                            } else if (Math.random() > 0.93) {
                                const rand = Math.random();
                                if (rand < 0.3) col = PALETTE.DECOR_RED;
                                else if (rand < 0.45) col = PALETTE.DECOR_GOLD;
                                else if (rand < 0.6) col = PALETTE.DECOR_ROYAL_BLUE;
                                else if (rand < 0.75) col = PALETTE.DECOR_PURPLE;
                                else if (rand < 0.85) col = PALETTE.DECOR_PINK;
                                else col = PALETTE.DECOR_SILVER;
                                isGlowing = true; 
                            }
                        }
                        add(x, worldY, z, col, isGlowing);
                    }
                }
            }
        }
    }

    const starY = treeBaseY + treeHeight + 1;
    for(let x=-2; x<=2; x++) for(let y=-2; y<=2; y++) for(let z=-2; z<=2; z++) {
        if (Math.abs(x)+Math.abs(y)+Math.abs(z) <= 3) add(x, starY+y, z, PALETTE.STAR_CORE, true);
    }
    const directions = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1], [1,1,0], [-1,1,0], [0,1,1], [0,1,-1]];
    directions.forEach(dir => {
        const len = (Math.abs(dir[0])+Math.abs(dir[1])+Math.abs(dir[2])) > 1 ? 5 : 9;
        for(let i=2; i<len; i++) add(dir[0]*i, starY + dir[1]*i, dir[2]*i, PALETTE.STAR_GLOW, true);
    });

    return { regularVoxels, glowingVoxels, lampCoords, doors, interactiveIce, waterVoxels };
};

// --- Interactive Components ---

const IcePond: React.FC<{ voxels: VoxelData[] }> = ({ voxels }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const [crackStage, setCrackStage] = useState(0);
    const [hovered, setHovered] = useState(false);
    
    // Geometry reuse
    const geometry = useMemo(() => new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE), []);
    
    // Calculate Pond Center roughly for the fracture generation
    const crackGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        const centerX = -35 * VOXEL_SIZE;
        const centerZ = 35 * VOXEL_SIZE;
        const surfaceY = (-2 * VOXEL_SIZE) + (VOXEL_SIZE * 0.5) + 0.02;
        const pondRadius = 16 * VOXEL_SIZE;

        // Recursive function to draw jagged lines ("Lightning")
        const addJaggedLine = (p1: THREE.Vector3, p2: THREE.Vector3, depth: number, maxOffset: number) => {
            if (depth <= 0) {
                points.push(p1);
                points.push(p2);
                return;
            }
            const mid = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
            mid.x += (Math.random() - 0.5) * maxOffset;
            mid.z += (Math.random() - 0.5) * maxOffset;
            
            addJaggedLine(p1, mid, depth - 1, maxOffset * 0.5);
            addJaggedLine(mid, p2, depth - 1, maxOffset * 0.5);
        };

        // 1. Radial Cracks (Spokes)
        const numSpokes = 12;
        for (let i = 0; i < numSpokes; i++) {
            const angle = (i / numSpokes) * Math.PI * 2 + (Math.random() * 0.5);
            const rStart = Math.random() * 2.0; 
            const rEnd = pondRadius * (0.8 + Math.random() * 0.3);
            
            const start = new THREE.Vector3(
                centerX + Math.cos(angle) * rStart, 
                surfaceY, 
                centerZ + Math.sin(angle) * rStart
            );
            const end = new THREE.Vector3(
                centerX + Math.cos(angle) * rEnd, 
                surfaceY, 
                centerZ + Math.sin(angle) * rEnd
            );
            
            addJaggedLine(start, end, 5, 0.5);
        }

        // 2. Connecting/Transverse Cracks (Spiderweb rings)
        const numRings = 8;
        for (let i = 0; i < numRings; i++) {
            const r = pondRadius * (0.2 + (i/numRings) * 0.8);
            const segments = 12 + i * 2;
            for(let j=0; j<segments; j++) {
                if (Math.random() > 0.6) continue; // Gap in the ring

                const angle1 = (j / segments) * Math.PI * 2;
                const angle2 = ((j+1) / segments) * Math.PI * 2;
                
                const p1 = new THREE.Vector3(
                    centerX + Math.cos(angle1) * r,
                    surfaceY,
                    centerZ + Math.sin(angle1) * r
                );
                const p2 = new THREE.Vector3(
                    centerX + Math.cos(angle2) * r,
                    surfaceY,
                    centerZ + Math.sin(angle2) * r
                );

                addJaggedLine(p1, p2, 3, 0.3);
            }
        }
        
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        voxels.forEach((voxel, i) => {
            dummy.position.set(voxel.x * VOXEL_SIZE, voxel.y * VOXEL_SIZE, voxel.z * VOXEL_SIZE);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
            
            // Basic Ice Color
            color.setHex(PALETTE.ICE);
            
            if (crackStage >= 1) {
               color.setHex(0xddeeff); 
            }
            
            meshRef.current!.setColorAt(i, color);
        });
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [voxels, crackStage]);

    const handleClick = (e: any) => {
        e.stopPropagation();
        setCrackStage(prev => prev + 1);
    };

    if (crackStage >= 3) {
        return null; // Broken, reveal deep water pit underneath
    }

    return (
        <group 
            onClick={handleClick}
            onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
            {/* The Solid Ice Mass */}
            <instancedMesh ref={meshRef} args={[geometry, undefined, voxels.length]}>
                <meshStandardMaterial 
                    transparent
                    opacity={0.85}
                    roughness={0.05}
                    metalness={0.1}
                />
            </instancedMesh>
            
            {/* The Hairline Cracks (Overlay) */}
            {crackStage > 0 && (
                <lineSegments geometry={crackGeometry}>
                    <lineBasicMaterial 
                        color={0xffffff} 
                        transparent 
                        opacity={crackStage === 1 ? 0.5 : 0.9} 
                        linewidth={1} 
                        depthTest={true}
                    />
                </lineSegments>
            )}
        </group>
    );
};

const Door: React.FC<DoorData> = ({ position, rotation }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hingeRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (hingeRef.current) {
            const targetRotation = isOpen ? -Math.PI / 1.5 : 0; 
            hingeRef.current.rotation.y = THREE.MathUtils.damp(
                hingeRef.current.rotation.y,
                targetRotation,
                4,
                delta
            );
        }
    });

    const doorWidth = 4 * VOXEL_SIZE;
    const doorHeight = 7 * VOXEL_SIZE;

    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <group ref={hingeRef}>
                <group 
                    position={[doorWidth / 2, doorHeight / 2, 0]} 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
                    onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
                >
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[doorWidth, doorHeight, VOXEL_SIZE]} />
                        <meshStandardMaterial color={hovered ? "#5d4030" : "#4a3222"} roughness={0.8} />
                    </mesh>
                    <mesh position={[doorWidth * 0.35, 0, VOXEL_SIZE * 0.6]}>
                        <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
                        <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 0, VOXEL_SIZE * 0.55]}>
                         <boxGeometry args={[doorWidth * 0.8, doorHeight * 0.8, 0.05]} />
                         <meshStandardMaterial color="#3e2a1c" />
                    </mesh>
                </group>
            </group>
        </group>
    );
};

export const VoxelWorld: React.FC<{ isNight: boolean }> = ({ isNight }) => {
    const { regularVoxels, glowingVoxels, lampCoords, doors, interactiveIce, waterVoxels } = useMemo(() => generateWorld(), []);
    const regularMesh = useRef<THREE.InstancedMesh>(null);
    const glowingMesh = useRef<THREE.InstancedMesh>(null);
    const waterMesh = useRef<THREE.InstancedMesh>(null);

    useLayoutEffect(() => {
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        if (regularMesh.current) {
            regularVoxels.forEach((voxel, i) => {
                dummy.position.set(voxel.x * VOXEL_SIZE, voxel.y * VOXEL_SIZE, voxel.z * VOXEL_SIZE);
                dummy.updateMatrix();
                regularMesh.current!.setMatrixAt(i, dummy.matrix);
                regularMesh.current!.setColorAt(i, color.setHex(voxel.color));
            });
            regularMesh.current.instanceMatrix.needsUpdate = true;
        }

        if (glowingMesh.current) {
            glowingVoxels.forEach((voxel, i) => {
                dummy.position.set(voxel.x * VOXEL_SIZE, voxel.y * VOXEL_SIZE, voxel.z * VOXEL_SIZE);
                dummy.updateMatrix();
                glowingMesh.current!.setMatrixAt(i, dummy.matrix);
                
                color.setHex(voxel.color);
                let intensity = 5.0; 
                
                if (voxel.color === PALETTE.LAMP_WARM) {
                    if (isNight) intensity = 50.0;
                    else { intensity = 0.5; color.setHex(0x555555); }
                } else if (voxel.color === PALETTE.LIGHT_WARM) {
                    if (isNight) intensity = 8.0;
                    else { intensity = 1.0; color.setHex(0xaaaaaa); }
                } else {
                    if (!isNight) intensity = 2.0; 
                }
                
                color.multiplyScalar(intensity); 
                glowingMesh.current!.setColorAt(i, color);
            });
            glowingMesh.current.instanceMatrix.needsUpdate = true;
        }

        if (waterMesh.current) {
            waterVoxels.forEach((voxel, i) => {
                dummy.position.set(voxel.x * VOXEL_SIZE, voxel.y * VOXEL_SIZE, voxel.z * VOXEL_SIZE);
                // Make water slightly lower to fit in the pit
                dummy.scale.set(1, 0.8, 1);
                dummy.updateMatrix();
                waterMesh.current!.setMatrixAt(i, dummy.matrix);
            });
            waterMesh.current.instanceMatrix.needsUpdate = true;
        }

    }, [regularVoxels, glowingVoxels, waterVoxels, isNight]);

    return (
        <group>
            <instancedMesh ref={regularMesh} args={[undefined, undefined, regularVoxels.length]} castShadow receiveShadow>
                <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
                <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0.1} />
            </instancedMesh>

            <instancedMesh ref={glowingMesh} args={[undefined, undefined, glowingVoxels.length]}>
                <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
                <meshBasicMaterial toneMapped={false} />
            </instancedMesh>
            
            {/* Water Mesh (Deep Pit) */}
            <instancedMesh ref={waterMesh} args={[undefined, undefined, waterVoxels.length]}>
                <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
                <meshStandardMaterial 
                    color={PALETTE.WATER} 
                    transparent 
                    opacity={0.9} 
                    roughness={0.0} 
                    metalness={0.5} 
                    emissive={0x000022}
                    emissiveIntensity={0.2}
                />
            </instancedMesh>

            {doors.map((door, idx) => (
                <Door key={idx} position={door.position} rotation={door.rotation} />
            ))}

            {interactiveIce.length > 0 && <IcePond voxels={interactiveIce} />}

            {isNight && lampCoords.map((pos, idx) => (
                <pointLight 
                    key={idx}
                    position={[pos.x, pos.y, pos.z]}
                    color="#ffaa44"
                    intensity={3.0}
                    distance={12}
                    decay={2}
                    castShadow={false} 
                />
            ))}
        </group>
    );
};

export const SnowParticles = () => {
    const count = 3000; 
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => {
        const temp = [];
        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * 80;
            const y = Math.random() * 40 + 10;
            const z = (Math.random() - 0.5) * 80;
            const speed = 0.01 + Math.random() * 0.04;
            temp.push({ x, y, z, speed, offset: Math.random() * 100 });
        }
        return temp;
    }, []);

    useFrame(() => {
        if (!mesh.current) return;
        particles.forEach((particle, i) => {
            particle.y -= particle.speed;
            if (particle.y < -5) particle.y = 50; 

            const time = Date.now() * 0.001;
            const wiggleX = Math.sin(time + particle.offset) * 0.2;
            const wiggleZ = Math.cos(time * 0.8 + particle.offset) * 0.2;
            
            dummy.position.set(particle.x + wiggleX, particle.y, particle.z + wiggleZ);
            dummy.scale.set(0.08, 0.08, 0.08); 
            dummy.updateMatrix();
            mesh.current!.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#fffafa" transparent opacity={0.6} />
        </instancedMesh>
    );
};