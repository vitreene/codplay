import type { EddyLegacySnapshot } from '../eddy-legacy-adapter'

export const eddySnapshotManual: EddyLegacySnapshot = {
  persos: [
    {
      type: 'VIDEO',
      initial: {
        id: 'scene-sound__7',
        tag: 'video',
        className: 'ed-video',
        move: 'container-scene',
        src: '/assets/1_7b_e.mp3',
        media: {
          action: 'play',
          changeAt: 0,
          offset: 0
        },
        attr: {
          hidden: 'hidden'
        }
      },
      actions: {
        'scene-sound__7': true
      },
      media: {}
    },
    {
      type: 'LIST',
      initial: {
        move: 'container-scene',
        tag: 'div',
        id: 'capsule__1',
        className: 'root-scene',
        style: {
          outline: '1px solid orangered'
        }
      },
      actions: {
        'capsule__1': true
      }
    },
    {
      type: 'LIST',
      initial: {
        tag: 'div',
        id: 'capsule__3',
        className: 'ed-caps ed-grid-w2-h2 cell-r1-c1',
        style: {
          fontFamily: 'Playfair Display',
          fontWeight: 'bold',
          backgroundColor: '#0873E6',
          margin: '2rem',
          fontSize: '3.3cqw',
          order: 10
        }
      },
      actions: {
        '3-003-donc-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__1'
        },
        '3-018-prvenir-outro': {
          style: {
            opacity: {
              to: 0,
              duration: 500
            },
            scale: {
              to: 2.5,
              duration: 500
            }
          }
        },
        'capsule__3': true
      }
    },
    {
      type: 'LIST',
      initial: {
        tag: 'div',
        id: 'capsule__2',
        className: 'ed-caps ed-grid-w1-h1 cell-r1-c1',
        style: {
          fontSize: '29px',
          color: '#DD1111',
          fontStyle: 'italic',
          backgroundColor: '#FF0000',
          order: 10
        }
      },
      actions: {
        '__auto_capsule_3_item_5_intro_460-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__3'
        },
        'capsule__2': true
      }
    },
    {
      type: 'IMG',
      initial: {
        id: 'item__1',
        tag: 'img',
        className: 'bg-picture ed-item cell-r1-c1',
        style: {
          fontFamily: 'Inter',
          fontSize: '24px',
          color: '#F40505',
          fontWeight: 'bold',
          order: 10,
          objectFit: 'cover'
        },
        src: '/assets/28970388742_2f75d527d6_z.jpg'
      },
      actions: {
        '3-009-risques-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            },
            y: {
              from: -250,
              to: 0,
              duration: 500
            }
          },
          move: 'capsule__2'
        },
        '3-017-les-outro': {
          style: {
            opacity: {
              to: 0,
              duration: 500
            },
            y: {
              to: 250,
              duration: 500
            }
          }
        },
        'item__1': true
      },
      media: {
        '/assets/28970388742_2f75d527d6_z.jpg': {
          img: {},
          src: 'http://localhost:5174/assets/28970388742_2f75d527d6_z.jpg',
          width: 640,
          height: 416,
          ratio: 1.5384615384615385
        }
      }
    },
    {
      type: 'IMG',
      initial: {
        id: 'item__2',
        tag: 'img',
        className: 'bg-picture ed-item cell_layout_auto-r1-c1',
        style: {
          fontSize: '16px',
          backgroundColor: '#DD11AA',
          order: 20,
          objectFit: 'cover'
        },
        src: '/assets/28999069391_5893263112_z.jpg'
      },
      actions: {
        '3-004-vu-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__2'
        },
        '3-008-des-outro': {
          style: {
            opacity: {
              to: 0,
              duration: 500
            }
          }
        },
        'item__2': true
      },
      media: {
        '/assets/28999069391_5893263112_z.jpg': {
          img: {},
          src: 'http://localhost:5174/assets/28999069391_5893263112_z.jpg',
          width: 640,
          height: 421,
          ratio: 1.520190023752969
        }
      }
    },
    {
      type: 'IMG',
      initial: {
        id: 'item__3',
        tag: 'img',
        className: 'bg-picture ed-item cell_layout_auto_grille-r1-c2',
        style: {
          fontStyle: 'italic',
          fontSize: '29px',
          color: '#DD1111',
          backgroundColor: '#10E499',
          order: 20,
          objectFit: 'cover'
        },
        src: '/assets/28999069391_5893263112_z.jpg'
      },
      actions: {
        '3-005-l-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__3'
        },
        '3-020-est-outro': {
          style: {
            opacity: {
              to: 0,
              duration: 500
            }
          }
        },
        'item__3': true
      },
      media: {
        '/assets/28999069391_5893263112_z.jpg': {
          img: {},
          src: 'http://localhost:5174/assets/28999069391_5893263112_z.jpg',
          width: 640,
          height: 421,
          ratio: 1.520190023752969
        }
      }
    },
    {
      type: 'TEXT',
      initial: {
        id: 'item__89',
        tag: 'p',
        className: 'ed-item cell-r2-c1',
        style: {
          order: 30
        },
        content: 'mon contenu'
      },
      actions: {
        '__auto_maximal__maximal_capsule_3_item_89_intro_460-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__3'
        },
        'item__89': true
      }
    },
    {
      type: 'TEXT',
      initial: {
        id: 'item__39',
        tag: 'p',
        className: 'ed-item cell_layout_auto_grille-r2-c2',
        style: {
          fontSize: '8.8cqw',
          order: 40
        },
        content: 'test2'
      },
      actions: {
        '3-003-donc-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__3'
        },
        '3-007-prsente-custom-1__tween': {
          style: {
            fontSize: {
              to: '8.8cqw',
              duration: 840
            },
            x: {
              to: 170,
              duration: 840
            },
            y: {
              to: -71,
              duration: 840
            },
            scaleX: {
              to: 0.53,
              duration: 840
            },
            scaleY: {
              to: 0.53,
              duration: 840
            },
            rotate: {
              to: 268,
              duration: 840
            },
            transformOrigin: {
              to: '50% 50%',
              duration: 840
            }
          }
        },
        '3-009-risques-outro': {
          style: {
            opacity: {
              to: 0,
              duration: 500
            }
          }
        },
        'item__39': true
      }
    },
    {
      type: 'IMG',
      initial: {
        id: 'item__53',
        tag: 'img',
        className: 'bg-picture ed-item cell-r2-c1',
        style: {
          objectFit: 'contain',
          order: 50
        },
        src: '/assets/1770735819457-32550066-da8f-47b3-be69-8911cf749156.png'
      },
      actions: {
        '3-003-donc-intro': {
          style: {
            opacity: {
              from: 0,
              to: 1,
              duration: 500
            }
          },
          move: 'capsule__3'
        },
        '3-007-prsente-custom-1__tween': {
          style: {
            backgroundSize: {
              to: 'contain',
              duration: 1060
            }
          }
        },
        '3-007-prsente-custom-1': {
          className: {
            add: 'cell-r1-c2',
            remove: 'cell-r2-c1'
          },
          move: {
            mode: 'auto'
          }
        },
        '3-014-risques-outro': {
          style: {
            opacity: {
              to: 0,
              duration: 500
            }
          }
        },
        'item__53': true
      },
      media: {
        '/assets/1770735819457-32550066-da8f-47b3-be69-8911cf749156.png': {
          img: {},
          src: 'http://localhost:5174/assets/1770735819457-32550066-da8f-47b3-be69-8911cf749156.png',
          width: 91,
          height: 91,
          ratio: 1
        }
      }
    },
    {
      type: 'TEXT',
      initial: {
        id: 'item__90',
        tag: 'p',
        move: 'capsule__1',
        className: 'ed-item cell_layout_auto-r1-c1',
        style: {
          order: 20
        },
        content: 'test 3'
      },
      actions: {
        'item__90': true
      }
    }
  ],
  eventtimes: new Map([
    [
      0,
      [
        {
          name: 'intro',
          start: 0
        }
      ]
    ],
    [
      2440,
      [
        {
          name: '3-009-risques-intro',
          start: 2440
        },
        {
          name: '3-008-des-outro',
          start: 2440
        }
      ]
    ],
    [
      5420,
      [
        {
          name: '3-017-les-outro',
          start: 5420
        }
      ]
    ],
    [
      640,
      [
        {
          name: '3-004-vu-intro',
          start: 640
        }
      ]
    ],
    [
      1180,
      [
        {
          name: '3-005-l-intro',
          start: 1180
        }
      ]
    ],
    [
      6620,
      [
        {
          name: '3-020-est-outro',
          start: 6620
        }
      ]
    ],
    [
      460,
      [
        {
          name: '__auto_capsule_3_item_5_intro_460-intro',
          start: 460
        },
        {
          name: '3-003-donc-intro',
          start: 460
        },
        {
          name: '3-003-donc-intro',
          start: 460
        },
        {
          name: '3-003-donc-intro',
          start: 460
        },
        {
          name: '__auto_maximal__maximal_capsule_3_item_89_intro_460-intro',
          start: 460
        }
      ]
    ],
    [
      5820,
      [
        {
          name: '3-018-prvenir-outro',
          start: 5820
        }
      ]
    ],
    [
      960,
      [
        {
          name: '3-007-prsente-custom-1__tween',
          start: 960
        },
        {
          name: '3-007-prsente-custom-1__tween',
          start: 960
        },
        {
          name: '3-007-prsente-custom-1__tween',
          start: 960
        }
      ]
    ],
    [
      1800,
      [
        {
          name: '3-007-prsente-custom-1',
          start: 1800
        },
        {
          name: '3-007-prsente-custom-1',
          start: 1800
        }
      ]
    ],
    [
      2840,
      [
        {
          name: '3-009-risques-outro',
          start: 2840
        }
      ]
    ],
    [
      2020,
      [
        {
          name: '3-007-prsente-custom-1',
          start: 2020
        }
      ]
    ],
    [
      4780,
      [
        {
          name: '3-014-risques-outro',
          start: 4780
        }
      ]
    ],
    [
      16800,
      [
        {
          name: 'outro',
          start: 16800
        }
      ]
    ],
    [
      17300,
      [
        {
          name: '__scene_end__',
          start: 17300
        }
      ]
    ]
  ])
}
