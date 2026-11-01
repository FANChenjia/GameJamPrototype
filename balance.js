(function(global){
"use strict";
global.ConcertoData = {
  "version": 2,
  "columns": 5,
  "rows": 4,
  "handLimit": 8,
  "prebuyLimit": 3,
  "drawMode": "manual",
  "refreshCost": 6,
  "shopRefreshCost": 2,
  "summonLimit": 2,
  "units": [
    {
      "id": "lyra",
      "name": "里拉琴",
      "family": "plucked",
      "icon": "harp",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 18,
      "attackSpeed": 1.5,
      "damage": 10.0,
      "unlock": 1,
      "summon": false,
      "piercing": true,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "贯穿所在列的全部敌人。每 10 次普攻使该列敌人受到伤害提高 25%，持续 10 秒。",
      "portrait": "lyra"
    },
    {
      "id": "harp",
      "name": "竖琴",
      "family": "plucked",
      "icon": "harp",
      "width": 2,
      "height": 1,
      "range": 2,
      "cost": 40,
      "attackSpeed": 1.0,
      "damage": 12.0,
      "unlock": 1,
      "summon": false,
      "piercing": true,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "description": "贯穿横向两列的全部敌人。每次普攻永久增加 1% 攻速，本关最多增加 100%。",
      "portrait": "harp"
    },
    {
      "id": "guqin",
      "name": "古琴",
      "family": "plucked",
      "icon": "piano",
      "width": 3,
      "height": 1,
      "range": 3,
      "cost": 60,
      "attackSpeed": 1.0,
      "damage": 15.0,
      "unlock": 1,
      "summon": true,
      "piercing": true,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ],
        [
          1,
          0
        ],
        [
          2,
          0
        ]
      ],
      "description": "贯穿横向三列，并施加 10 秒印记；到期追加期间生命伤害的 30%。召唤后持续至本波结束。",
      "portrait": "guqin"
    },
    {
      "id": "flute",
      "name": "长笛",
      "family": "wind",
      "icon": "flute",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 34,
      "attackSpeed": 1.5,
      "damage": 15.0,
      "unlock": 2,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "攻击所在列最前排敌人。每件真实吹奏乐器提供 25% 协奏增伤；双簧管在场再增加 25%。",
      "portrait": "flute"
    },
    {
      "id": "oboe",
      "name": "双簧管",
      "family": "wind",
      "icon": "flute",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 34,
      "attackSpeed": 1.5,
      "damage": 15.0,
      "unlock": 2,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "攻击所在列最前排敌人。每件真实吹奏乐器提供 25% 协奏增伤；长笛在场再增加 25%。",
      "portrait": "oboe"
    },
    {
      "id": "trumpet",
      "name": "小号",
      "family": "wind",
      "icon": "trumpet",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 32,
      "attackSpeed": 1.0,
      "damage": 20.0,
      "unlock": 2,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "攻击所在列最前排敌人，享受吹奏协奏。上低音号在场时额外增加 150% 伤害，最终攻速减半。",
      "portrait": "trumpet"
    },
    {
      "id": "euphonium",
      "name": "上低音号",
      "family": "wind",
      "icon": "trumpet",
      "width": 2,
      "height": 2,
      "range": 2,
      "cost": 84,
      "attackSpeed": 0.33,
      "damage": 100.0,
      "unlock": 2,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ],
        [
          1,
          0
        ],
        [
          0,
          1
        ],
        [
          1,
          1
        ]
      ],
      "description": "占据 2×2 格，每次对横向两列各攻击一个前排敌人，享受吹奏协奏，并强化场上的小号。",
      "portrait": "euphonium"
    },
    {
      "id": "suona",
      "name": "唢呐",
      "family": "wind",
      "icon": "trumpet",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 55,
      "attackSpeed": 2.0,
      "damage": 0.0,
      "unlock": 1,
      "summon": true,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "享受吹奏协奏，无基础伤害。每 5 次普攻净化一个前排普通敌人；对 Boss 改为造成最大生命 3% 伤害。持续至本关结束。",
      "portrait": "suona"
    },
    {
      "id": "snare",
      "name": "军鼓",
      "family": "percussion",
      "icon": "drum",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 40,
      "attackSpeed": 0.5,
      "damage": 30.0,
      "unlock": 3,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "普攻打击全场敌人。每 5 次普攻使随机一件非打击乐器永久增加 10% 攻速；累计 100 次普攻或释放技能使全场晕眩 1 秒；每次普攻计 1 次，不随目标数量增加。",
      "portrait": "snare"
    },
    {
      "id": "shaker",
      "name": "沙锤",
      "family": "percussion",
      "icon": "bells",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 26,
      "attackSpeed": 5.0,
      "damage": 2.0,
      "unlock": 3,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "以每秒 5 次的频率打击全场敌人。累计 100 次普攻触发重音，使全场晕眩 1 秒；每次普攻仅计 1 次。",
      "portrait": "shaker"
    },
    {
      "id": "marimba",
      "name": "马林巴",
      "family": "percussion",
      "icon": "bells",
      "width": 5,
      "height": 1,
      "range": 5,
      "cost": 56,
      "attackSpeed": 0.5,
      "damage": 28,
      "unlock": 3,
      "summon": false,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ],
        [
          1,
          0
        ],
        [
          2,
          0
        ],
        [
          3,
          0
        ],
        [
          4,
          0
        ]
      ],
      "description": "横占一整行，普攻打击全场，普通怪受到 7 段合计 28 点伤害，Boss 合并为一次伤害。被动：每造成一次伤害，视作一次普攻计入重音；累计 100 次使全场晕眩 1 秒。",
      "portrait": "marimba"
    },
    {
      "id": "gong",
      "name": "锣",
      "family": "percussion",
      "icon": "drum",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 50,
      "attackSpeed": 0.2,
      "damage": 50.0,
      "unlock": 1,
      "summon": true,
      "piercing": false,
      "areaAttack": false,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "每次普攻打击全场敌人，并释放技能使全场晕眩 1 秒。召唤后持续至本波结束。",
      "portrait": "gong"
    },
    {
      "id": "violin",
      "name": "小提琴",
      "family": "bowed",
      "icon": "violin",
      "width": 1,
      "height": 1,
      "range": 1,
      "cost": 34,
      "attackSpeed": 2.0,
      "damage": 7.5,
      "unlock": 4,
      "summon": false,
      "piercing": false,
      "areaAttack": true,
      "shape": [
        [
          0,
          0
        ]
      ],
      "description": "在所在列的随机位置形成路径长度 1/3 的区域，伤害区域内敌人并减速 15%。每列只能由一件常驻拉弦乐器覆盖。",
      "portrait": "violin"
    },
    {
      "id": "viola",
      "name": "中提琴",
      "family": "bowed",
      "icon": "violin",
      "width": 2,
      "height": 1,
      "range": 2,
      "cost": 52,
      "attackSpeed": 2.0,
      "damage": 7.5,
      "unlock": 4,
      "summon": false,
      "piercing": false,
      "areaAttack": true,
      "shape": [
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "description": "横向覆盖两列，各自在随机位置形成路径长度 1/3 的区域，伤害并减速 25%。覆盖列不能与其他常驻拉弦重叠。",
      "portrait": "viola"
    },
    {
      "id": "cello",
      "name": "大提琴",
      "family": "bowed",
      "icon": "cello",
      "width": 3,
      "height": 1,
      "range": 3,
      "cost": 72,
      "attackSpeed": 2.0,
      "damage": 7.5,
      "unlock": 4,
      "summon": false,
      "piercing": false,
      "areaAttack": true,
      "shape": [
        [
          0,
          0
        ],
        [
          1,
          0
        ],
        [
          2,
          0
        ]
      ],
      "description": "横向覆盖三列，各自在随机位置形成路径长度 1/3 的区域，伤害并减速 40%。覆盖列不能与其他常驻拉弦重叠。",
      "portrait": "cello"
    }
  ],
  "cards": [
    {
      "id": "Presto",
      "name": "急板",
      "cost": 12,
      "rhythm": 2,
      "weight": 14,
      "shopWeight": 10,
      "description": "指定 1 件攻速 +25%，5 秒",
      "target": "unit",
      "summon": null,
      "art": "assets/cards/Presto.png"
    },
    {
      "id": "Prestissimo",
      "name": "狂板",
      "cost": 24,
      "rhythm": 4,
      "weight": 7,
      "shopWeight": 6,
      "description": "指定 1 件攻速 +100%，5 秒",
      "target": "unit",
      "summon": null,
      "art": "assets/cards/Prestissimo.png"
    },
    {
      "id": "Cadenza",
      "name": "华彩乐段",
      "cost": 38,
      "rhythm": 7,
      "weight": 7,
      "shopWeight": 6,
      "description": "全体攻速 +50%，10 秒",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Cadenza.png"
    },
    {
      "id": "Forte",
      "name": "强音",
      "cost": 24,
      "rhythm": 4,
      "weight": 15,
      "shopWeight": 12,
      "description": "全体普攻直接伤害 +50%，10 秒",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Forte.png"
    },
    {
      "id": "Sforzando",
      "name": "突强",
      "cost": 24,
      "rhythm": 4,
      "weight": 10,
      "shopWeight": 8,
      "description": "指定 1 件下次普攻直接伤害额外 +900%，合计 10 倍",
      "target": "unit",
      "summon": null,
      "art": "assets/cards/Sforzando.png"
    },
    {
      "id": "Syncopation",
      "name": "切分",
      "cost": 14,
      "rhythm": 3,
      "weight": 7,
      "shopWeight": 5,
      "description": "全体攻击无视护盾，10 秒",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Syncopation.png"
    },
    {
      "id": "Rondo",
      "name": "回旋曲",
      "cost": 45,
      "rhythm": 8,
      "weight": 9,
      "shopWeight": 7,
      "description": "全体每次普攻附加目标最大生命 2%，10 秒；Boss 为 0.2%",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Rondo.png"
    },
    {
      "id": "Rhapsody",
      "name": "狂想曲",
      "cost": 18,
      "rhythm": 3,
      "weight": 3,
      "shopWeight": 2,
      "description": "全体普攻生成提琴区，触发持续 5 秒；区域长度 1/3、2 秒、15 DPS、15% 减速",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Rhapsody.png"
    },
    {
      "id": "Resonance",
      "name": "共鸣",
      "cost": 18,
      "rhythm": 3,
      "weight": 6,
      "shopWeight": 5,
      "description": "指定 1 件立即释放 1 次可触发技能",
      "target": "unit",
      "summon": null,
      "art": "assets/cards/Resonance.png"
    },
    {
      "id": "Diminuendo",
      "name": "渐弱",
      "cost": 12,
      "rhythm": 2,
      "weight": 5,
      "shopWeight": 4,
      "description": "全场敌人减速 30%，5 秒",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Diminuendo.png"
    },
    {
      "id": "Fermata",
      "name": "休止符",
      "cost": 22,
      "rhythm": 4,
      "weight": 4,
      "shopWeight": 3,
      "description": "全场敌人冻结 3 秒",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Fermata.png"
    },
    {
      "id": "Guqin",
      "name": "古琴",
      "cost": 60,
      "rhythm": 12,
      "weight": 0,
      "shopWeight": 8,
      "description": "召唤古琴，至本波结束；开局开放，仅局外商店",
      "target": "summon",
      "summon": "guqin",
      "art": "assets/cards/Guqin.svg"
    },
    {
      "id": "Suona",
      "name": "唢呐",
      "cost": 55,
      "rhythm": 12,
      "weight": 0,
      "shopWeight": 7,
      "description": "召唤唢呐，至本关结束；开局开放，仅局外商店",
      "target": "summon",
      "summon": "suona",
      "art": "assets/cards/Suona.svg"
    },
    {
      "id": "Luo",
      "name": "锣",
      "cost": 50,
      "rhythm": 11,
      "weight": 0,
      "shopWeight": 5,
      "description": "召唤锣，至本波结束；开局开放，仅局外商店",
      "target": "summon",
      "summon": "gong",
      "art": "assets/cards/Luo.svg"
    },
    {
      "id": "Accorder",
      "name": "调弦",
      "cost": 12,
      "rhythm": 2,
      "weight": 3,
      "shopWeight": 2,
      "description": "时停并允许整盘重排 1 次，确认后恢复",
      "target": "arrange",
      "summon": null,
      "art": "assets/cards/Accorder.png"
    },
    {
      "id": "Duet",
      "name": "二重奏",
      "cost": 28,
      "rhythm": 5,
      "weight": 3,
      "shopWeight": 3,
      "description": "指定 1 件生成 50% 伤害分身，10 秒",
      "target": "unit",
      "summon": null,
      "art": "assets/cards/Duet.png"
    },
    {
      "id": "Infinite",
      "name": "无穷动",
      "cost": 40,
      "rhythm": 8,
      "weight": 2,
      "shopWeight": 3,
      "description": "全体临时覆盖 5 列，5 秒；普通单体仍每列只命中最前排",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Infinite.png"
    },
    {
      "id": "Requiem",
      "name": "安魂曲",
      "cost": 65,
      "rhythm": 12,
      "weight": 2,
      "shopWeight": 2,
      "description": "每个在场敌人独立受到自身已损生命 100% 的伤害，1 次",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Requiem.png"
    },
    {
      "id": "Improvisation",
      "name": "即兴",
      "cost": 14,
      "rhythm": 3,
      "weight": 2,
      "shopWeight": 1,
      "description": "随机获得 2 张非召唤牌；不产生召唤牌、不解锁内容",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Improvisation.png"
    },
    {
      "id": "Deduction",
      "name": "推演",
      "cost": 2,
      "rhythm": 1,
      "weight": 1,
      "shopWeight": 1,
      "description": "获得 1 次局内免费手动刷新",
      "target": "global",
      "summon": null,
      "art": "assets/cards/Deduction.png"
    }
  ],
  "levels": [
    {
      "id": "1-1",
      "index": 0,
      "part": 1,
      "duration": 120,
      "island": 1,
      "waveDuration": 120,
      "initial": 90,
      "income": 1.0,
      "cap": 5,
      "reward": 10,
      "waves": [
        {
          "count": 45,
          "hp": 120,
          "bossHp": 171,
          "bossLane": 2,
          "normalRewardBudget": 20,
          "travelTime": 28,
          "rushCount": 4,
          "rushHp": 185,
          "rushTravelTime": 10
        }
      ],
      "bossName": "风鸣之鹿",
      "bossPortrait": "1-1"
    },
    {
      "id": "2-1",
      "index": 1,
      "part": 1,
      "duration": 120,
      "island": 2,
      "waveDuration": 60,
      "initial": 160,
      "income": 1.5,
      "cap": 8,
      "reward": 14,
      "waves": [
        {
          "count": 48,
          "hp": 150,
          "bossHp": 855,
          "bossLane": 2,
          "normalRewardBudget": 32,
          "travelTime": 28,
          "rushCount": 5,
          "rushHp": 180,
          "rushTravelTime": 10
        },
        {
          "count": 54,
          "hp": 170,
          "bossHp": 1045,
          "bossLane": 1,
          "normalRewardBudget": 36,
          "travelTime": 28,
          "rushCount": 5,
          "rushHp": 205,
          "rushTravelTime": 10
        }
      ],
      "bossName": "星尘夜蛾",
      "bossPortrait": "2-1"
    },
    {
      "id": "2-2",
      "index": 2,
      "part": 2,
      "duration": 120,
      "island": 2,
      "waveDuration": 60,
      "initial": 160,
      "income": 1.5,
      "cap": 8,
      "reward": 14,
      "waves": [
        {
          "count": 60,
          "hp": 190,
          "bossHp": 1188,
          "bossLane": 2,
          "normalRewardBudget": 40,
          "travelTime": 28,
          "rushCount": 6,
          "rushHp": 230,
          "rushTravelTime": 10
        },
        {
          "count": 66,
          "hp": 210,
          "bossHp": 1283,
          "bossLane": 1,
          "normalRewardBudget": 44,
          "travelTime": 28,
          "rushCount": 7,
          "rushHp": 250,
          "rushTravelTime": 10
        }
      ],
      "bossName": "流星鸮",
      "bossPortrait": "2-2"
    },
    {
      "id": "3-1",
      "index": 3,
      "part": 1,
      "duration": 120,
      "island": 3,
      "waveDuration": 60,
      "initial": 440,
      "income": 2.0,
      "cap": 12,
      "reward": 18,
      "waves": [
        {
          "count": 78,
          "hp": 360,
          "bossHp": 25650,
          "bossLane": 2,
          "normalRewardBudget": 52,
          "travelTime": 28,
          "rushCount": 8,
          "rushHp": 486,
          "rushTravelTime": 12
        },
        {
          "count": 90,
          "hp": 400,
          "bossHp": 26125,
          "bossLane": 1,
          "normalRewardBudget": 60,
          "travelTime": 28,
          "rushCount": 9,
          "rushHp": 540,
          "rushTravelTime": 12
        }
      ],
      "bossName": "鼓岩巨龟",
      "bossPortrait": "3-1"
    },
    {
      "id": "3-2",
      "index": 4,
      "part": 2,
      "duration": 120,
      "island": 3,
      "waveDuration": 60,
      "initial": 440,
      "income": 2.0,
      "cap": 12,
      "reward": 18,
      "waves": [
        {
          "count": 96,
          "hp": 440,
          "bossHp": 26600,
          "bossLane": 2,
          "normalRewardBudget": 64,
          "travelTime": 28,
          "rushCount": 10,
          "rushHp": 594,
          "rushTravelTime": 12
        },
        {
          "count": 108,
          "hp": 480,
          "bossHp": 27075,
          "bossLane": 1,
          "normalRewardBudget": 72,
          "travelTime": 28,
          "rushCount": 11,
          "rushHp": 648,
          "rushTravelTime": 12
        }
      ],
      "bossName": "铜角犀",
      "bossPortrait": "3-2"
    },
    {
      "id": "4-1",
      "index": 5,
      "part": 1,
      "duration": 120,
      "island": 4,
      "waveDuration": 40,
      "initial": 590,
      "income": 2.5,
      "cap": 16,
      "reward": 22,
      "waves": [
        {
          "count": 120,
          "hp": 300,
          "bossHp": 47500,
          "bossLane": 2,
          "normalRewardBudget": 80,
          "travelTime": 28,
          "rushCount": 12,
          "rushHp": 405,
          "rushTravelTime": 12
        },
        {
          "count": 132,
          "hp": 320,
          "bossHp": 47975,
          "bossLane": 1,
          "normalRewardBudget": 88,
          "travelTime": 28,
          "rushCount": 13,
          "rushHp": 432,
          "rushTravelTime": 12
        },
        {
          "count": 144,
          "hp": 340,
          "bossHp": 48450,
          "bossLane": 3,
          "normalRewardBudget": 96,
          "travelTime": 28,
          "rushCount": 14,
          "rushHp": 459,
          "rushTravelTime": 12
        }
      ],
      "bossName": "弦雾水母",
      "bossPortrait": "4-1"
    },
    {
      "id": "4-2",
      "index": 6,
      "part": 2,
      "duration": 120,
      "island": 4,
      "waveDuration": 40,
      "initial": 590,
      "income": 2.5,
      "cap": 16,
      "reward": 22,
      "waves": [
        {
          "count": 150,
          "hp": 360,
          "bossHp": 48925,
          "bossLane": 2,
          "normalRewardBudget": 100,
          "travelTime": 28,
          "rushCount": 15,
          "rushHp": 486,
          "rushTravelTime": 12
        },
        {
          "count": 162,
          "hp": 380,
          "bossHp": 49400,
          "bossLane": 1,
          "normalRewardBudget": 108,
          "travelTime": 28,
          "rushCount": 16,
          "rushHp": 513,
          "rushTravelTime": 12
        },
        {
          "count": 174,
          "hp": 400,
          "bossHp": 49875,
          "bossLane": 3,
          "normalRewardBudget": 116,
          "travelTime": 28,
          "rushCount": 17,
          "rushHp": 540,
          "rushTravelTime": 12
        }
      ],
      "bossName": "织弦蛛",
      "bossPortrait": "4-2"
    },
    {
      "id": "5-1",
      "index": 7,
      "part": 1,
      "duration": 120,
      "island": 5,
      "waveDuration": 40,
      "initial": 710,
      "income": 3.0,
      "cap": 18,
      "reward": 28,
      "waves": [
        {
          "count": 180,
          "hp": 420,
          "bossHp": 60800,
          "bossLane": 2,
          "normalRewardBudget": 120,
          "travelTime": 28,
          "rushCount": 18,
          "rushHp": 567,
          "rushTravelTime": 12
        },
        {
          "count": 192,
          "hp": 440,
          "bossHp": 61275,
          "bossLane": 1,
          "normalRewardBudget": 128,
          "travelTime": 28,
          "rushCount": 19,
          "rushHp": 594,
          "rushTravelTime": 12
        },
        {
          "count": 204,
          "hp": 460,
          "bossHp": 61750,
          "bossLane": 3,
          "normalRewardBudget": 136,
          "travelTime": 28,
          "rushCount": 20,
          "rushHp": 621,
          "rushTravelTime": 12
        }
      ],
      "bossName": "云海鲸",
      "bossPortrait": "5-1"
    },
    {
      "id": "5-2",
      "index": 8,
      "part": 2,
      "duration": 120,
      "island": 5,
      "waveDuration": 40,
      "initial": 710,
      "income": 3.0,
      "cap": 18,
      "reward": 28,
      "waves": [
        {
          "count": 216,
          "hp": 480,
          "bossHp": 62225,
          "bossLane": 2,
          "normalRewardBudget": 144,
          "travelTime": 28,
          "rushCount": 22,
          "rushHp": 648,
          "rushTravelTime": 12
        },
        {
          "count": 228,
          "hp": 500,
          "bossHp": 62700,
          "bossLane": 1,
          "normalRewardBudget": 152,
          "travelTime": 28,
          "rushCount": 23,
          "rushHp": 675,
          "rushTravelTime": 12
        },
        {
          "count": 240,
          "hp": 520,
          "bossHp": 63175,
          "bossLane": 3,
          "normalRewardBudget": 160,
          "travelTime": 28,
          "rushCount": 24,
          "rushHp": 702,
          "rushTravelTime": 12
        }
      ],
      "bossName": "星冠龙",
      "bossPortrait": "5-2"
    },
    {
      "id": "5-3",
      "index": 9,
      "part": 3,
      "duration": 120,
      "island": 5,
      "waveDuration": 40,
      "initial": 710,
      "income": 3.0,
      "cap": 18,
      "reward": 28,
      "waves": [
        {
          "count": 252,
          "hp": 530,
          "bossHp": 63650,
          "bossLane": 2,
          "normalRewardBudget": 168,
          "travelTime": 28,
          "rushCount": 25,
          "rushHp": 716,
          "rushTravelTime": 12
        },
        {
          "count": 264,
          "hp": 540,
          "bossHp": 64125,
          "bossLane": 1,
          "normalRewardBudget": 176,
          "travelTime": 28,
          "rushCount": 26,
          "rushHp": 729,
          "rushTravelTime": 12
        },
        {
          "count": 276,
          "hp": 550,
          "bossHp": 64600,
          "bossLane": 3,
          "normalRewardBudget": 184,
          "travelTime": 28,
          "rushCount": 28,
          "rushHp": 743,
          "rushTravelTime": 12
        }
      ],
      "bossName": "终章天琴",
      "bossPortrait": "5-3"
    }
  ],
  "islands": [
    {
      "name": "风鸣岛",
      "english": "Windsong Island",
      "symbol": "harp",
      "newFamily": "拨弦"
    },
    {
      "name": "星摇岛",
      "english": "Starrock Island",
      "symbol": "flute",
      "newFamily": "吹奏"
    },
    {
      "name": "鼓岩岛",
      "english": "Drumrock Island",
      "symbol": "drum",
      "newFamily": "打击"
    },
    {
      "name": "弦雾岛",
      "english": "Chordmist Island",
      "symbol": "violin",
      "newFamily": "拉弦"
    },
    {
      "name": "天空岛",
      "english": "Sky Island",
      "symbol": "bells",
      "newFamily": "全乐器"
    }
  ],
  "bossWidth": 3
};
})(typeof window!=='undefined'?window:globalThis);
