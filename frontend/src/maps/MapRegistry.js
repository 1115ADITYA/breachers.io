import { ContainerYardMap } from './ContainerYardMap.js';
import { WarehouseMap } from './WarehouseMap.js';

/**
 * MapRegistry
 * Central modular map registry for Breachers.io.
 * Handles map metadata, availability state, supported game modes,
 * and lazy instantiation of map scenes.
 */
export const MAP_REGISTRY = {
  container_yard: {
    id: 'container_yard',
    name: 'Container Yard',
    subtitle: 'Sector 04 — Freight Logistics Terminal',
    status: 'AVAILABLE',
    isAvailable: true,
    description: 'Corrugated ISO shipping containers, gantry crane towers, and multi-lane flanking routes in an open-air maritime cargo depot.',
    modes: ['TDM (30)', 'FFA (20)'],
    maxPlayers: 10,
    badgeText: 'AVAILABLE',
    previewBadgeColor: '#10b981',
    createInstance: () => new ContainerYardMap()
  },
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    subtitle: 'Reforge Logistics Depot',
    status: 'AVAILABLE',
    isAvailable: true,
    description: 'Enclosed industrial distribution center featuring high-ceiling storage bays, forklift alleys, stacked crates, and central room fortifications.',
    modes: ['TDM (30)', 'FFA (20)'],
    maxPlayers: 10,
    badgeText: 'AVAILABLE',
    previewBadgeColor: '#10b981',
    createInstance: () => new WarehouseMap()
  },
  desert_outpost: {
    id: 'desert_outpost',
    name: 'Desert Outpost',
    subtitle: 'Arid Forward Operating Base',
    status: 'COMING SOON',
    isAvailable: false,
    description: 'Fortified military checkpoint and supply depot nestled in a sun-baked desert canyon corridor.',
    modes: ['TDM (30)', 'FFA (20)'],
    maxPlayers: 10,
    badgeText: 'COMING SOON',
    previewBadgeColor: '#f59e0b',
    createInstance: null
  },
  urban_streets: {
    id: 'urban_streets',
    name: 'Urban Streets',
    subtitle: 'Commercial District Grid',
    status: 'COMING SOON',
    isAvailable: false,
    description: 'Multi-level metropolitan avenues, storefront facades, and tight alley chokepoints in a contested urban zone.',
    modes: ['TDM (30)', 'FFA (20)'],
    maxPlayers: 10,
    badgeText: 'COMING SOON',
    previewBadgeColor: '#f59e0b',
    createInstance: null
  }
};

export const DEFAULT_MAP_ID = 'container_yard';

export function getMapConfig(mapId) {
  return MAP_REGISTRY[mapId] || MAP_REGISTRY[DEFAULT_MAP_ID];
}

export function getAllMaps() {
  return Object.values(MAP_REGISTRY);
}
