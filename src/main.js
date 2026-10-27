import Phaser from 'phaser';
import gameConfig from './game/config/gameConfig.js';
import { mountGameUI } from './game/ui.js';
import './styles/main.css';

new Phaser.Game(gameConfig);
mountGameUI();
