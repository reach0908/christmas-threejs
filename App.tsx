import React, { useState, useEffect, useCallback } from 'react';
import { GameScene } from './components/GameScene';
import { Gift, GameState, GiftType, Snowman } from './types';

// Constants matching VoxelAssets
const VOXEL_SIZE = 0.25;

// Helper to get random color
const getRandomColor = () => {
  const colors = ['#ff0000', '#00ff00', '#3333ff', '#ffd700', '#ff00ff', '#00ffff', '#ff6b00'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Helper to get random gift type
const getRandomType = (): GiftType => {
  const types: GiftType[] = ['box', 'box', 'cane', 'ornament', 'ornament', 'stocking', 'gingerbread', 'star'];
  return types[Math.floor(Math.random() * types.length)];
};

// --- Exact Terrain Logic from VoxelAssets ---
const getTerrainVoxelY = (logicalX: number, logicalZ: number): number => {
    // 1. Ponds (Flat Ice)
    // Center (-35, 35), Radius ~16-18
    const distToPond = Math.sqrt((logicalX - (-35))**2 + (logicalZ - 35)**2);
    if (distToPond < 16) return -2; // Ice level

    // 2. Paths (Flat Ground)
    // Simplified path check matching the visual generation roughly
    // Central Hub
    const distToCenter = Math.sqrt(logicalX**2 + logicalZ**2);
    if (distToCenter < 5) return 0;

    // We can't easily replicate the exact path map without expensive computation,
    // but for random scatter, we generally assume "Wild" terrain.
    // If an object falls on a path (y=0) but we calculate noise height, it might float/sink.
    // However, the main paths are usually at y=0.
    // Let's rely on the noise function for the general terrain. 
    // If it looks odd on paths, we can add exclusion zones.

    // 3. General Terrain Noise (Exact Formula)
    const noise = Math.sin(logicalX * 0.05) * Math.cos(logicalZ * 0.05) * 6 + Math.sin(logicalX*0.1 + logicalZ*0.2)*2;
    return Math.floor(noise);
};

const generateGifts = (count: number): Gift[] => {
  const gifts: Gift[] = [];
  let idCounter = 0;

  const addGift = (x: number, y: number, z: number, type: GiftType = getRandomType()) => {
    gifts.push({
      id: idCounter++,
      position: [x, y, z],
      color: getRandomColor(),
      collected: false,
      type: type,
      rotation: [Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5]
    });
  };

  // 1. PLACE ON TREE (Spiral upwards)
  // Tree is at (0,0). Matches VoxelAssets tree logic for surface placement.
  const treeCount = 12; // Increased count for better visibility
  const maxRadius = 32;
  const treeHeight = 100;

  for (let i = 0; i < treeCount; i++) {
    // Height between 15% and 85% of tree
    const heightPercent = 0.15 + (Math.random() * 0.7); 
    const yVoxel = heightPercent * treeHeight;
    
    // Exact radius logic from VoxelAssets: 
    // currentRadius = maxRadius * (1 - progress) + (Math.sin(y * 0.5) * 1.5);
    const radiusAtHeight = maxRadius * (1 - heightPercent) + (Math.sin(yVoxel * 0.5) * 1.5);
    
    // Place on the edge (foliage surface)
    const angle = Math.random() * Math.PI * 2;
    
    // Modified: Place slightly OUTSIDE the calculated radius (radius + 1.5 voxels)
    // ensuring items are visible on the surface rather than buried inside.
    const r = radiusAtHeight + 1.5; 

    const xVoxel = Math.cos(angle) * r;
    const zVoxel = Math.sin(angle) * r;
    
    addGift(
      xVoxel * VOXEL_SIZE, 
      (yVoxel * VOXEL_SIZE), 
      zVoxel * VOXEL_SIZE, 
      i % 2 === 0 ? 'ornament' : 'star'
    );
  }

  // 2. PLACE IN HOUSES
  // Floor is consistently at Y=0 for these houses.
  const houses = [
      { x: 50, z: 0, w: 12, d: 16 },
      { x: 30, z: -50, w: 10, d: 12 },
      { x: -40, z: -40, w: 14, d: 10 },
      { x: 0, z: 60, w: 16, d: 12 },
  ];

  houses.forEach(h => {
      const numInside = 1 + Math.floor(Math.random() * 2);
      for(let k=0; k<numInside; k++) {
          const rX = (Math.random() - 0.5) * (h.w - 5);
          const rZ = (Math.random() - 0.5) * (h.d - 5);
          
          addGift(
            (h.x + rX) * VOXEL_SIZE, 
            (0 * VOXEL_SIZE) + 0.3, // Floor is 0. +0.3 to sit on floor.
            (h.z + rZ) * VOXEL_SIZE,
            'stocking'
          );
      }
  });

  // 3. PLACE ON ICE POND
  // Ice surface is at voxel Y = -2.
  const pondCount = 4;
  for(let i=0; i<pondCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 12; 
      const px = -35 + Math.cos(angle) * r;
      const pz = 35 + Math.sin(angle) * r;
      
      addGift(
          px * VOXEL_SIZE,
          (-2 * VOXEL_SIZE) + 0.3, // Sit on ice
          pz * VOXEL_SIZE,
          'cane'
      );
  }

  // 4. RANDOM TERRAIN SCATTER (The rest)
  const currentCount = gifts.length;
  const targetInitial = 25;
  const remaining = Math.max(0, targetInitial - currentCount);
  
  for (let i = 0; i < remaining; i++) {
    let xVoxel, zVoxel;
    let valid = false;
    let attempts = 0;
    
    while (!valid && attempts < 50) {
      attempts++;
      // Random scan in a large area
      xVoxel = (Math.random() - 0.5) * 160; 
      zVoxel = (Math.random() - 0.5) * 160;
      
      // Avoid center tree trunk
      if (Math.sqrt(xVoxel**2 + zVoxel**2) < 6) continue;

      // Get exact terrain height
      const yVoxel = getTerrainVoxelY(xVoxel, zVoxel);
      
      // Convert to world
      const worldY = (yVoxel * VOXEL_SIZE) + 0.5; // +0.5 to lift center of gift box above ground

      addGift(xVoxel * VOXEL_SIZE, worldY, zVoxel * VOXEL_SIZE);
      valid = true;
    }
  }

  return gifts;
};

const generateSnowmen = (count: number): Snowman[] => {
    const snowmen: Snowman[] = [];
    const maxRange = 70; // Voxel units radius

    for(let i=0; i<count; i++) {
        let xVoxel, zVoxel, yVoxel = 0;
        let valid = false;
        let attempts = 0;

        // Specific scenic spots for first few
        if (i === 0) { xVoxel = 15; zVoxel = 15; }
        else if (i === 1) { xVoxel = -20; zVoxel = -10; } // Near path
        else {
            // Random placement
            while (!valid && attempts < 20) {
                attempts++;
                xVoxel = (Math.random() - 0.5) * 2 * maxRange;
                zVoxel = (Math.random() - 0.5) * 2 * maxRange;
                
                // Avoid center
                if (Math.sqrt(xVoxel**2 + zVoxel**2) < 8) continue;
                valid = true;
            }
        }
        
        if (!xVoxel) xVoxel = 10; 
        if (!zVoxel) zVoxel = 10;

        // Calculate Ground Height
        yVoxel = getTerrainVoxelY(xVoxel, zVoxel);

        // Snowman visual adjustment
        const worldY = (yVoxel * VOXEL_SIZE); 

        snowmen.push({
            id: i,
            position: [xVoxel * VOXEL_SIZE, worldY, zVoxel * VOXEL_SIZE],
            rotation: Math.random() * Math.PI * 2,
            hp: 3,
            isDead: false
        });
    }
    return snowmen;
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    started: false,
    gifts: [],
    snowmen: [],
    foundCount: 0,
    gameOver: false,
  });

  // Initialize Game
  useEffect(() => {
    setGameState(prev => ({
      ...prev,
      gifts: generateGifts(30), 
      snowmen: generateSnowmen(5)
    }));
  }, []);

  const handleCollect = useCallback((id: number) => {
    setGameState(prev => {
      const gift = prev.gifts.find(g => g.id === id);
      if (gift && gift.collected) return prev;

      const newGifts = prev.gifts.map(g => g.id === id ? { ...g, collected: true } : g);
      const newCount = prev.foundCount + 1;
      const totalGoals = 30;

      return {
        ...prev,
        gifts: newGifts,
        foundCount: newCount,
        gameOver: newCount >= totalGoals,
      };
    });
  }, []);

  const handleSnowmanHit = useCallback((id: number) => {
      setGameState(prev => {
          const sm = prev.snowmen.find(s => s.id === id);
          if (!sm || sm.isDead) return prev;

          const newHp = sm.hp - 1;
          const isDead = newHp <= 0;
          
          let newGifts = [...prev.gifts];
          
          if (isDead) {
              const newGiftId = 1000 + id; 
              newGifts.push({
                  id: newGiftId,
                  // Spawn gift slightly above where snowman was
                  position: [sm.position[0], sm.position[1] + 1.0, sm.position[2]], 
                  color: '#ff00ff', 
                  collected: false,
                  type: 'gingerbread',
                  rotation: [0, 0, 0]
              });
          }

          const newSnowmen = prev.snowmen.map(s => s.id === id ? { ...s, hp: newHp, isDead } : s);

          return {
              ...prev,
              snowmen: newSnowmen,
              gifts: newGifts
          };
      });
  }, []);

  const startGame = () => {
    setGameState(prev => ({ ...prev, started: true }));
  };

  return (
    <div className="relative w-full h-full font-sans text-white select-none">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0 bg-black">
        <GameScene 
            gifts={gameState.gifts} 
            snowmen={gameState.snowmen}
            onCollect={handleCollect} 
            onSnowmanHit={handleSnowmanHit}
        />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Top HUD */}
        <div className="flex justify-between items-start">
           <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-lg flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-yellow-400 drop-shadow-md">Christmas Hunt</h1>
              <p className="text-sm text-gray-200">Find 30 items!</p>
              <div className="flex gap-2 text-xs text-gray-400 mt-1">
                  <span>🎄 Ornaments</span>
                  <span>🧦 Stockings</span>
                  <span className="text-white font-bold">☃️ Break Snowmen!</span>
              </div>
           </div>
           
           <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/20 flex flex-col items-center min-w-[120px] shadow-lg">
              <span className="text-xs uppercase tracking-wider text-gray-400">Presents</span>
              <span className="text-4xl font-bold font-mono text-green-400">
                {gameState.foundCount}<span className="text-white/50 text-2xl">/30</span>
              </span>
           </div>
        </div>

        {/* Start Screen */}
        {!gameState.started && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto backdrop-blur-sm z-50">
                <div className="max-w-md text-center space-y-6 p-8 border border-white/10 rounded-2xl bg-gray-900/90 shadow-2xl">
                    <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-green-500">
                        Winter Voxel Wonderland
                    </h2>
                    <p className="text-gray-300 leading-relaxed">
                        The elves have hidden presents everywhere!<br/>
                        Some are hidden inside the <strong className="text-white">Snowmen</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 bg-black/30 p-4 rounded-lg">
                        <div className="text-white">👆 <strong>WASD / Drag</strong><br/><span className="text-xs text-gray-500">to Move View</span></div>
                        <div className="text-white">🖱️ <strong>Right Click</strong><br/><span className="text-xs text-gray-500">to Rotate</span></div>
                        <div className="col-span-2">☃️ <strong>Click Snowmen</strong> 3 times to break!</div>
                    </div>
                    <button 
                        onClick={startGame}
                        className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-full transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                    >
                        Start Hunting
                    </button>
                </div>
            </div>
        )}

        {/* Win Screen */}
        {gameState.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-900/90 pointer-events-auto backdrop-blur-md z-50">
                 <div className="text-center space-y-6 animate-bounce-slow">
                    <h2 className="text-6xl font-bold text-yellow-300 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                        Merry Christmas!
                    </h2>
                    <p className="text-2xl text-white">You found all the hidden treasures!</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-8 px-8 py-3 bg-white text-green-900 hover:bg-gray-100 rounded-full transition-colors font-bold shadow-xl"
                    >
                        Play Again
                    </button>
                 </div>
            </div>
        )}

        {/* Controls Hint */}
        {gameState.started && !gameState.gameOver && (
            <div className="self-center">
                <div className="bg-black/40 px-6 py-2 rounded-full text-xs text-gray-300 backdrop-blur-sm border border-white/10">
                    Click Snowmen 3 times to find hidden gifts! • Check inside houses
                </div>
            </div>
        )}
        
      </div>
    </div>
  );
};

export default App;