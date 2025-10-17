// Define the normalized coordinates for splitting and stacking the map blocks
export const splitX = 0.363;
export const splitY = reverse => reverse ? 0.430 : 0.459;

// Define boundaries for each region in its own normalized space
export const eastYRange = [-0.238, 0.234];
export const westYRange = [-0.225, 0.234];
export const alaskaXRange = [-0.363, -0.176];
export const alaskaYRange = [0.121, 0.234];
export const hawaiiXRange = [-0.176, -0.083];
export const hawaiiYRange = [0.166, 0.227];
export const puertoRicoXRange = [0.309, 0.363];
export const puertoRicoYRange = [0.204, 0.234];

export const epsilon = 1e-6;