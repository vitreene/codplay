import type { SceneDoc } from '../../player/types'

/**
 * Creates one business-oriented reference scene with persistent decor and quiz branching.
 */
export function createS4QuizReferenceScene(): SceneDoc {
  return {
    id: 's4-quiz-reference-scene',
    rootStories: ['s4-quiz-decor-story', 's4-quiz-intro-story'],
    initial: undefined,
    straps: undefined,
    listen: [
      {
        on: 'quiz:answer:yes',
        emit: [
          {
            name: 'story:start',
            data: { storyId: 's4-quiz-success-story' },
            cascade: true
          }
        ]
      },
      {
        on: 'quiz:answer:no',
        emit: [
          {
            name: 'story:start',
            data: { storyId: 's4-quiz-failure-story' },
            cascade: true
          }
        ]
      }
    ],
    stories: {
      's4-quiz-decor-story': {
        id: 's4-quiz-decor-story',
        entries: [
          'quiz-stage',
          'quiz-decor-layer',
          'quiz-decor-circle-a',
          'quiz-decor-circle-b',
          'quiz-decor-circle-c'
        ],
        initial: undefined,
        persos: [
          {
            id: 'quiz-stage',
            type: 'list',
            initial: {
              className: 'quiz-stage',
              style: {
                width: '720px',
                minHeight: '420px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                borderRadius: '24px'
              }
            },
            actions: {}
          },
          {
            id: 'quiz-decor-layer',
            type: 'list',
            initial: {
              className: 'quiz-decor-layer',
              move: {
                parentId: 'quiz-stage',
                mode: 'append'
              },
              style: {
                minHeight: '360px'
              }
            },
            actions: {}
          },
          {
            id: 'quiz-decor-circle-a',
            type: 'text',
            initial: {
              tag: 'div',
              content: '',
              move: {
                parentId: 'quiz-decor-layer',
                mode: 'append'
              },
              style: {
                width: '120px',
                height: '120px',
                borderRadius: '999px',
                backgroundColor: 'rgba(56, 189, 248, 0.24)',
                x: -30,
                y: 0
              }
            },
            actions: {
              'quiz:decor:drift': {
                style: {
                  x: {
                    from: -30,
                    to: 70,
                    duration: 6000
                  },
                  y: {
                    from: 0,
                    to: 24,
                    duration: 6000
                  }
                }
              }
            }
          },
          {
            id: 'quiz-decor-circle-b',
            type: 'text',
            initial: {
              tag: 'div',
              content: '',
              move: {
                parentId: 'quiz-decor-layer',
                mode: 'append'
              },
              style: {
                width: '88px',
                height: '88px',
                borderRadius: '999px',
                backgroundColor: 'rgba(129, 140, 248, 0.22)',
                x: 240,
                y: 18
              }
            },
            actions: {
              'quiz:decor:drift': {
                style: {
                  x: {
                    from: 240,
                    to: 180,
                    duration: 6000
                  },
                  y: {
                    from: 18,
                    to: 54,
                    duration: 6000
                  }
                }
              }
            }
          },
          {
            id: 'quiz-decor-circle-c',
            type: 'text',
            initial: {
              tag: 'div',
              content: '',
              move: {
                parentId: 'quiz-decor-layer',
                mode: 'append'
              },
              style: {
                width: '160px',
                height: '160px',
                borderRadius: '999px',
                backgroundColor: 'rgba(34, 197, 94, 0.14)',
                x: 430,
                y: -12
              }
            },
            actions: {
              'quiz:decor:drift': {
                style: {
                  x: {
                    from: 430,
                    to: 380,
                    duration: 6000
                  },
                  y: {
                    from: -12,
                    to: 16,
                    duration: 6000
                  }
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'quiz:decor:drift',
            startAt: 0
          }
        ]
      },
      's4-quiz-intro-story': {
        id: 's4-quiz-intro-story',
        entries: ['quiz-intro-panel', 'quiz-intro-title'],
        initial: undefined,
        persos: [
          {
            id: 'quiz-intro-panel',
            type: 'list',
            initial: {
              className: 'quiz-intro-panel',
              style: {
                position: 'absolute',
                left: '180px',
                top: '84px',
                width: '280px',
                minHeight: '96px',
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '18px',
                opacity: 0,
                x: -160,
                y: 0
              }
            },
            actions: {
              'quiz:intro:show': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 250
                  },
                  x: {
                    from: -160,
                    to: 0,
                    duration: 250
                  }
                }
              },
              'quiz:intro:hide': {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 250
                  },
                  x: {
                    from: 0,
                    to: 180,
                    duration: 250
                  }
                }
              }
            }
          },
          {
            id: 'quiz-intro-title',
            type: 'text',
            initial: {
              tag: 'h1',
              content: 'Quiz',
              move: {
                parentId: 'quiz-intro-panel',
                mode: 'append'
              },
              style: {
                color: '#0f172a'
              }
            },
            actions: {}
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'quiz:intro:show',
            startAt: 0
          },
          {
            name: 'quiz:intro:hide',
            startAt: 2000
          }
        ]
      },
      's4-quiz-question-story': {
        id: 's4-quiz-question-story',
        entries: ['quiz-question-panel', 'quiz-question-title', 'quiz-answer-yes', 'quiz-answer-no'],
        initial: undefined,
        persos: [
          {
            id: 'quiz-question-panel',
            type: 'list',
            initial: {
              className: 'quiz-question-panel',
              style: {
                position: 'absolute',
                left: '150px',
                top: '196px',
                width: '420px',
                minHeight: '160px',
                padding: '20px',
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                opacity: 0,
                x: 120,
                y: 0
              }
            },
            actions: {
              'quiz:question:show': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 250
                  },
                  x: {
                    from: 120,
                    to: 0,
                    duration: 250
                  }
                }
              },
              'quiz:answer:yes': {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 200
                  },
                  x: {
                    from: 0,
                    to: -80,
                    duration: 200
                  }
                }
              },
              'quiz:answer:no': {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 200
                  },
                  x: {
                    from: 0,
                    to: -80,
                    duration: 200
                  }
                }
              }
            }
          },
          {
            id: 'quiz-question-title',
            type: 'text',
            initial: {
              tag: 'p',
              content: 'La V1 est-elle prete ? ',
              move: {
                parentId: 'quiz-question-panel',
                mode: 'append'
              },
              style: {
                color: '#0f172a'
              }
            },
            actions: {}
          },
          {
            id: 'quiz-answer-yes',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'Oui',
              move: {
                parentId: 'quiz-question-panel',
                mode: 'append'
              },
              style: {
                display: 'inline-block',
                marginRight: '12px',
                marginTop: '16px',
                padding: '10px 16px',
                border: '1px solid #166534',
                borderRadius: '999px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontWeight: 700,
                cursor: 'pointer'
              }
            },
            emit: {
              click: {
                event: {
                  name: 'quiz:answer:yes',
                  cascade: true
                }
              }
            },
            actions: {}
          },
          {
            id: 'quiz-answer-no',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'Non',
              move: {
                parentId: 'quiz-question-panel',
                mode: 'append'
              },
              style: {
                display: 'inline-block',
                marginTop: '16px',
                padding: '10px 16px',
                border: '1px solid #991b1b',
                borderRadius: '999px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                fontWeight: 700,
                cursor: 'pointer'
              }
            },
            emit: {
              click: {
                event: {
                  name: 'quiz:answer:no',
                  cascade: true
                }
              }
            },
            actions: {}
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'quiz:question:show',
            startAt: 2300
          }
        ]
      },
      's4-quiz-success-story': {
        id: 's4-quiz-success-story',
        entries: ['quiz-success-panel'],
        initial: undefined,
        persos: [
          {
            id: 'quiz-success-panel',
            type: 'text',
            initial: {
              tag: 'div',
              content: 'Gagne',
              style: {
                position: 'absolute',
                left: '200px',
                top: '208px',
                padding: '18px',
                borderRadius: '16px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                opacity: 0,
                x: 100,
                y: 0
              }
            },
            actions: {
              'quiz:answer:yes': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 220
                  },
                  x: {
                    from: 100,
                    to: 0,
                    duration: 220
                  }
                }
              },
              'quiz:result:correct:show': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 220
                  },
                  x: {
                    from: 100,
                    to: 0,
                    duration: 220
                  }
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'quiz:result:correct:show',
            startAt: 0
          }
        ]
      },
      's4-quiz-failure-story': {
        id: 's4-quiz-failure-story',
        entries: ['quiz-failure-panel'],
        initial: undefined,
        persos: [
          {
            id: 'quiz-failure-panel',
            type: 'text',
            initial: {
              tag: 'div',
              content: 'Helas...',
              style: {
                position: 'absolute',
                left: '200px',
                top: '208px',
                padding: '18px',
                borderRadius: '16px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                opacity: 0,
                x: 100,
                y: 0
              }
            },
            actions: {
              'quiz:answer:no': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 220
                  },
                  x: {
                    from: 100,
                    to: 0,
                    duration: 220
                  }
                }
              },
              'quiz:result:wrong:show': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 220
                  },
                  x: {
                    from: 100,
                    to: 0,
                    duration: 220
                  }
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'quiz:result:wrong:show',
            startAt: 0
          }
        ]
      }
    },
    init(_scene, options) {
      options.mount('s4-quiz-decor-story')
      options.mount('s4-quiz-intro-story')
      options.mount('s4-quiz-question-story')
      options.mount('s4-quiz-success-story')
      options.mount('s4-quiz-failure-story')
    },
    onStart(_scene, options) {
      options.start('s4-quiz-decor-story')
      options.start('s4-quiz-intro-story')
      options.start('s4-quiz-question-story')
    },
    tracks: {}
  }
}
