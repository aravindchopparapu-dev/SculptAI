export const studioScreens = ['Studio', 'My training', 'Insights', 'Fuel', 'Coach'] as const;
export type StudioScreen = (typeof studioScreens)[number];

const tabByScreen: Record<StudioScreen, string> = {
  Studio: 'studio',
  'My training': 'training',
  Insights: 'insights',
  Fuel: 'fuel',
  Coach: 'coach',
};

export function tabForScreen(screen: StudioScreen) {
  return tabByScreen[screen];
}

export function screenForTab(tab: string | null | undefined): StudioScreen | null {
  return studioScreens.find((screen) => tabByScreen[screen] === tab) ?? null;
}
