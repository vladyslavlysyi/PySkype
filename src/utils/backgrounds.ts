const doodlePattern = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' opacity='0.08'%3E%3Cpath d='M20 20 A 5 5 0 0 1 30 20 A 5 5 0 0 1 20 20 M22 22 L28 28 M22 28 L28 22'/%3E%3Ccircle cx='70' cy='30' r='8'/%3E%3Cpath d='M65 30 L75 30 M70 25 L70 35'/%3E%3Crect x='20' y='60' width='15' height='15' rx='3'/%3E%3Cpath d='M25 65 L30 70 M30 65 L25 70'/%3E%3Cpolygon points='75,70 85,85 65,85'/%3E%3Cpath d='M75 75 L75 80 M45 45 A 10 10 0 0 1 55 45'/%3E%3Cpath d='M45 55 Q 50 45 55 55'/%3E%3Ccircle cx='10' cy='80' r='2'/%3E%3Ccircle cx='90' cy='10' r='2'/%3E%3Ccircle cx='50' cy='90' r='3'/%3E%3Cpath d='M 10 40 Q 20 30 30 40 T 50 40 T 70 40'/%3E%3C/g%3E%3C/svg%3E")`;

export const predefinedBackgrounds = [
  // Telegram-style colorful gradients with doodle patterns
  `${doodlePattern}, linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)`, // Light Green
  `${doodlePattern}, linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)`, // Blue
  `${doodlePattern}, linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)`, // Dark Purple
  `${doodlePattern}, linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)`, // Pink
  `${doodlePattern}, linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)`, // Cyan
  `${doodlePattern}, linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)`, // Light Blue/Purple
  `${doodlePattern}, linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)`, // Clean White/Grey
  `${doodlePattern}, linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)`, // Soft Purple
  `${doodlePattern}, linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)`, // Peach/Orange
  `${doodlePattern}, linear-gradient(135deg, #09203f 0%, #537895 100%)`, // Dark Blue
]
