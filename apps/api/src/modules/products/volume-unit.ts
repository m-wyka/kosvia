import type { VolumeUnit as VolumeUnitEnum } from '@prisma/client';
import type { VolumeUnit } from '@kosvia/shared';

const MILLILITRES_PER_FLUID_OUNCE = 29.5735;
const GRAMS_PER_KILOGRAM = 1000;
const MILLILITRES_PER_LITRE = 1000;

export const toVolumeUnitEnum = (unit: string | null | undefined): VolumeUnitEnum => {
  switch ((unit ?? 'ml').toLowerCase()) {
    case 'g':
      return 'G';
    case 'piece':
      return 'PIECE';
    default:
      return 'ML';
  }
};

export const toVolumeUnitDto = (unit: VolumeUnitEnum): VolumeUnit =>
  unit.toLowerCase() as VolumeUnit;

/**
 * Brings a label quantity ("1.7 fl oz", "0,5 l", "50 g") to the units the
 * catalogue stores. Returns null volume when the unit cannot be normalised.
 */
export const normaliseQuantity = (
  amount: number,
  rawUnit: string,
): { volume: number | null; volumeUnit: VolumeUnitEnum } => {
  const unit = rawUnit.toLowerCase().replace(/\s+/g, '');
  switch (unit) {
    case 'ml':
      return { volume: amount, volumeUnit: 'ML' };
    case 'l':
      return { volume: amount * MILLILITRES_PER_LITRE, volumeUnit: 'ML' };
    case 'floz':
      return { volume: Math.round(amount * MILLILITRES_PER_FLUID_OUNCE), volumeUnit: 'ML' };
    case 'g':
      return { volume: amount, volumeUnit: 'G' };
    case 'kg':
      return { volume: amount * GRAMS_PER_KILOGRAM, volumeUnit: 'G' };
    case 'pcs':
    case 'pc':
    case 'piece':
    case 'pieces':
    case 'szt':
      return { volume: amount, volumeUnit: 'PIECE' };
    default:
      return { volume: null, volumeUnit: 'ML' };
  }
};
