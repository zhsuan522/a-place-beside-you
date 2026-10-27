import Phaser from 'phaser';

const ASSETS = `${import.meta.env.BASE_URL}assets/packs/kenney/background-elements-remastered`;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.starSeed = 37;
  }

  preload() {
    this.load.image('treehouseTree', `${ASSETS}/PNG/Default/tree.png`);
    this.load.image('treehouseHome', `${ASSETS}/PNG/Default/houseSmall1.png`);
    this.load.image('forestTree', `${ASSETS}/PNG/Default/treePine.png`);
    this.load.image('shorePalm', `${ASSETS}/PNG/Default/treePalm.png`);
    this.load.image('planetIcon0', `${import.meta.env.BASE_URL}assets/packs/kenney/planets/Planets/planet00.png`);
    this.load.image('starIcon', `${import.meta.env.BASE_URL}assets/packs/kenney/ui-pack-adventure/PNG/Double/minimap_icon_star_yellow.png`);
  }

  create() {
    this.paintWorld();
    this.scale.on('resize', this.paintWorld, this);
  }

  paintWorld() {
    const { width, height } = this.scale;
    this.children.removeAll(true);

    const art = this.add.graphics();
    art.fillStyle(0x101936, 1).fillRect(0, 0, width, height);
    art.fillStyle(0x354271, 0.2).fillCircle(width * 0.26, height * 0.42, Math.max(width, height) * 0.45);
    art.fillStyle(0x534078, 0.13).fillCircle(width * 0.83, height * 0.18, Math.max(width, height) * 0.3);

    let seed = this.starSeed;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < Math.round((width * height) / 9000); i += 1) {
      const x = random() * width;
      const y = random() * height * 0.78;
      const radius = random() > 0.92 ? 2.2 : random() > 0.64 ? 1.25 : 0.7;
      art.fillStyle(random() > 0.83 ? 0xffe8b0 : 0xe4e9ff, 0.35 + random() * 0.55).fillCircle(x, y, radius);
    }

    const moonX = width * 0.22;
    const moonY = height * 0.22;
    art.fillStyle(0xf7dfa8, 0.08).fillCircle(moonX, moonY, Math.min(width, height) * 0.12);
    art.fillStyle(0xffedc1, 0.92).fillCircle(moonX, moonY, Math.min(width, height) * 0.055);
    art.fillStyle(0x101936, 1).fillCircle(moonX + Math.min(width, height) * 0.025, moonY - Math.min(width, height) * 0.018, Math.min(width, height) * 0.052);

    // A quiet hillside gives the Kenney treehouse a place to sit without competing with the UI.
    art.fillStyle(0x1b2947, 0.92).fillEllipse(width * 0.29, height * 0.96, width * 0.88, height * 0.38);
    art.fillStyle(0x233452, 0.72).fillEllipse(width * 0.03, height * 1.01, width * 0.65, height * 0.32);
    art.fillStyle(0x324060, 0.62).fillEllipse(width * 0.62, height * 1.015, width * 0.75, height * 0.29);

    const smallScreen = width < 720;
    const scale = Math.min(smallScreen ? width / 410 : width / 1100, height / 760, 1.15);
    const treeX = smallScreen ? width * 0.16 : width * 0.275;
    const treeBottom = height * 0.92;
    const tree = this.add.image(treeX, treeBottom, 'treehouseTree').setOrigin(0.5, 1).setScale(scale * (smallScreen ? 1.48 : 2.55)).setAlpha(0.92);
    tree.setDepth(2);

    const houseX = smallScreen ? width * 0.18 : width * 0.31;
    const houseY = treeBottom - 116 * scale;
    art.fillStyle(0x8f684f, 0.95).fillRoundedRect(houseX - 62 * scale, houseY + 19 * scale, 124 * scale, 13 * scale, 6 * scale);
    art.fillStyle(0xffdf9c, 0.1).fillCircle(houseX, houseY, 70 * scale);
    this.add.image(houseX, houseY, 'treehouseHome').setScale(scale * (smallScreen ? 2.35 : 2.85)).setDepth(4);

    // Small lanterns and paths make the scene feel lived in while remaining decorative.
    art.lineStyle(2 * scale, 0xf7dca1, 0.18).beginPath().moveTo(houseX + 20 * scale, houseY + 25 * scale).lineTo(houseX + 53 * scale, treeBottom - 4 * scale).strokePath();
    art.fillStyle(0xffda91, 0.88).fillCircle(houseX + 48 * scale, treeBottom - 17 * scale, 3.5 * scale);
    art.fillStyle(0xffda91, 0.42).fillCircle(houseX + 48 * scale, treeBottom - 17 * scale, 11 * scale);

    if (!smallScreen) {
      this.add.image(width * 0.78, height * 0.73, 'forestTree').setOrigin(0.5, 1).setScale(scale * 1.55).setAlpha(0.26).setDepth(1);
      this.add.image(width * 0.92, height * 0.78, 'shorePalm').setOrigin(0.5, 1).setScale(scale * 1.25).setAlpha(0.18).setDepth(1);
    }
  }
}
