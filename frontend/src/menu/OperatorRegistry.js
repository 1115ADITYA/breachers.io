/**
 * OperatorRegistry
 * Defines selectable Breachers.io operators, roles, visual material themes,
 * and tactical loadout profiles.
 */
export const OPERATOR_REGISTRY = {
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    callsign: 'VANGUARD-01',
    role: 'Frontline Assault',
    description: 'Special forces breacher equipped with modular ballistic plating and high-contrast tactical HUD optics for rapid room clearing.',
    armorColor: 0x1d4ed8, // Tactical Navy Blue
    vestColor: 0x0f172a,  // Midnight Black Kevlar
    visorColor: 0x00e5ff, // Cyan Tactical HUD
    accentColor: 0xf97316, // Orange Accent
    camoName: 'Maritime Spec-Ops',
    stats: {
      armor: '85 / 100',
      mobility: '90 / 100',
      breach: '95 / 100',
      difficulty: 'Moderate'
    },
    variants: [
      { id: 'standard', name: 'Standard Issue Navy', armor: 0x1d4ed8, visor: 0x00e5ff },
      { id: 'stealth', name: 'Shadow Carbon', armor: 0x18181b, visor: 0x38bdf8 },
      { id: 'hazard', name: 'Hazard Orange', armor: 0xc2410c, visor: 0xfef08a }
    ]
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost',
    callsign: 'SPECTRE-09',
    role: 'Recon Infiltrator',
    description: 'Black-ops infiltration operative outfitted with carbon-weave silent stealth gear and infrared night vision optics.',
    armorColor: 0x18181b, // Stealth Carbon Black
    vestColor: 0x090d16,  // Deep Midnight Vest
    visorColor: 0xef4444, // Crimson Red Night Vision
    accentColor: 0x94a3b8, // Slate Steel Accent
    camoName: 'Shadow Covert',
    stats: {
      armor: '70 / 100',
      mobility: '100 / 100',
      breach: '75 / 100',
      difficulty: 'Advanced'
    },
    variants: [
      { id: 'standard', name: 'Covert Blackout', armor: 0x18181b, visor: 0xef4444 },
      { id: 'arctic', name: 'Arctic Ghost', armor: 0xd4d4d8, visor: 0x06b6d4 },
      { id: 'crimson', name: 'Bloodline Ops', armor: 0x450a0a, visor: 0xf87171 }
    ]
  },
  stryker: {
    id: 'stryker',
    name: 'Stryker',
    callsign: 'STRYKER-44',
    role: 'Desert Operator',
    description: 'Rapid strike combatant conditioned for desert warfare, featuring dust-filtering ballistic headwear and amber thermal goggles.',
    armorColor: 0xb58a58, // Desert Tan / Sand Dust
    vestColor: 0x44301d,  // Dark Coyote Vest
    visorColor: 0xfbbf24, // Amber Gold Visor
    accentColor: 0x78716c, // Stone Khaki Accent
    camoName: 'Arid Storm',
    stats: {
      armor: '80 / 100',
      mobility: '85 / 100',
      breach: '85 / 100',
      difficulty: 'Easy'
    },
    variants: [
      { id: 'standard', name: 'Desert Dune', armor: 0xb58a58, visor: 0xfbbf24 },
      { id: 'coyote', name: 'Coyote Spec', armor: 0x78350f, visor: 0xfde047 },
      { id: 'wasteland', name: 'Wasteland Dust', armor: 0x57534e, visor: 0xeab308 }
    ]
  },
  enforcer: {
    id: 'enforcer',
    name: 'Enforcer',
    callsign: 'TITAN-03',
    role: 'Heavy Pointman',
    description: 'Reinforced demolition and point-defense vanguard bearing maximum reinforced composite armor with emerald thermal target lock.',
    armorColor: 0x22422c, // Olive Drab Green
    vestColor: 0x142017,  // Dark Forest Kevlar
    visorColor: 0x10b981, // Emerald Green Thermal
    accentColor: 0xd97706, // Brass Accent
    camoName: 'Forest Siege',
    stats: {
      armor: '100 / 100',
      mobility: '70 / 100',
      breach: '100 / 100',
      difficulty: 'Beginner'
    },
    variants: [
      { id: 'standard', name: 'Olive Fortress', armor: 0x22422c, visor: 0x10b981 },
      { id: 'urban', name: 'Urban Juggernaut', armor: 0x334155, visor: 0x34d399 },
      { id: 'bronze', name: 'Siege Bronze', armor: 0x713f12, visor: 0x6ee7b7 }
    ]
  }
};

export const DEFAULT_OPERATOR_ID = 'vanguard';

export function getOperator(id) {
  return OPERATOR_REGISTRY[id] || OPERATOR_REGISTRY[DEFAULT_OPERATOR_ID];
}

export function getAllOperators() {
  return Object.values(OPERATOR_REGISTRY);
}
