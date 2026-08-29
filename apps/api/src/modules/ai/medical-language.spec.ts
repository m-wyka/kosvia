import { findMedicalLanguage } from './medical-language';

describe('findMedicalLanguage', () => {
  it.each([
    'Ten krem wyleczy trądzik w tydzień.',
    'Serum leczy przebarwienia.',
    'To brzmi jak choroba skóry.',
    'Zalecam odstawienie kremu od lekarza.',
    'This serum cures acne.',
    'It treats rosacea effectively.',
    'You should stop taking your prescription.',
  ])('flags %p', (answer) => {
    expect(findMedicalLanguage(answer)).not.toBeNull();
  });

  it.each([
    'Niacynamid pomaga wyrównać koloryt i wspiera barierę skóry.',
    'Niacinamide supports the skin barrier; treat this as information, not advice.',
    'If the irritation persists, it is worth talking to a dermatologist.',
  ])('accepts %p', (answer) => {
    expect(findMedicalLanguage(answer)).toBeNull();
  });
});
