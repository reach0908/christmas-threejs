import React from 'react';

export type GiftType = 'box' | 'cane' | 'ornament' | 'stocking' | 'gingerbread' | 'star';

export interface Gift {
  id: number;
  position: [number, number, number];
  color: string;
  collected: boolean;
  type: GiftType;
  rotation?: [number, number, number];
}

export interface Snowman {
    id: number;
    position: [number, number, number];
    rotation: number;
    hp: number; // Health points (3 hits to break)
    isDead: boolean;
}

export interface GameState {
  started: boolean;
  gifts: Gift[];
  snowmen: Snowman[];
  foundCount: number;
  gameOver: boolean;
}

export type Vector3Tuple = [number, number, number];

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      instancedMesh: any;
      boxGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      torusGeometry: any;
      coneGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      pointLight: any;
      directionalLight: any;
      hemisphereLight: any;
      orthographicCamera: any;
      color: any;
      fog: any;
      ambientLight: any;
      primitive: any;
      lineSegments: any;
      lineBasicMaterial: any;
      [elemName: string]: any;
    }
  }
}