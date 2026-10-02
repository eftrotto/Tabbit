/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tabbit.json`.
 */
export type Tabbit = {
  "address": "Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn",
  "metadata": {
    "name": "tabbit",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Tabbit: on-chain meal benefits with programmable rules"
  },
  "instructions": [
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "ownerToken",
          "docs": [
            "Conta de token da empresa de onde sai o dinheiro."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "approval",
          "docs": [
            "Empresa precisa estar aprovada pela plataforma para colocar dinheiro na rede."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  112,
                  112,
                  114,
                  111,
                  118,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Token oficial do benefício (USDC, ou o token de teste na devnet)."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "pay",
      "discriminator": [
        119,
        18,
        216,
        65,
        192,
        117,
        122,
        220
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Carteira do funcionário."
          ],
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "employer.owner",
                "account": "employer"
              }
            ]
          },
          "relations": [
            "employee"
          ]
        },
        {
          "name": "employee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "merchant",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  99,
                  104,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "merchant.wallet",
                "account": "merchant"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "merchantToken",
          "docs": [
            "Conta de token do restaurante (precisa existir; o SDK cria se faltar)."
          ],
          "writable": true
        },
        {
          "name": "treasuryToken",
          "docs": [
            "Conta de token da tesouraria da plataforma (recebe a taxa)."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "approval",
          "docs": [
            "No fim da lista para não mudar a posição das outras contas (o fee payer confere por posição)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  112,
                  112,
                  114,
                  111,
                  118,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerEmployer",
      "discriminator": [
        154,
        33,
        113,
        170,
        63,
        118,
        124,
        26
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Só o token oficial do benefício: impede empresa com token próprio sem valor."
          ]
        },
        {
          "name": "vault",
          "docs": [
            "Cofre: ATA do mint cujo dono é o PDA da empresa."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "employer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "tzOffsetMinutes",
          "type": "i16"
        }
      ]
    },
    {
      "name": "registerMerchant",
      "discriminator": [
        238,
        245,
        77,
        132,
        161,
        88,
        216,
        248
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "merchant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  99,
                  104,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "wallet",
          "type": "pubkey"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "category",
          "type": "u8"
        }
      ]
    },
    {
      "name": "revokeEmployee",
      "discriminator": [
        156,
        87,
        184,
        102,
        169,
        209,
        184,
        126
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "employee"
          ]
        },
        {
          "name": "employee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              },
              {
                "kind": "account",
                "path": "employee.wallet",
                "account": "employee"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "setEmployerApproved",
      "discriminator": [
        255,
        192,
        197,
        118,
        175,
        96,
        252,
        103
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "employer"
        },
        {
          "name": "approval",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  112,
                  112,
                  114,
                  111,
                  118,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "approved",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setMerchantActive",
      "discriminator": [
        135,
        200,
        111,
        155,
        7,
        90,
        21,
        169
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "merchant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  99,
                  104,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "merchant.wallet",
                "account": "merchant"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setMint",
      "discriminator": [
        166,
        129,
        167,
        223,
        137,
        118,
        212,
        47
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "e autoridade são conferidos no handler."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "upsertEmployee",
      "discriminator": [
        25,
        162,
        240,
        211,
        30,
        81,
        226,
        144
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "employee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "employer"
              },
              {
                "kind": "arg",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "wallet",
          "type": "pubkey"
        },
        {
          "name": "balance",
          "type": "u64"
        },
        {
          "name": "maxPerMeal",
          "type": "u64"
        },
        {
          "name": "dailyCap",
          "type": "u64"
        },
        {
          "name": "windowStartMin",
          "type": "u16"
        },
        {
          "name": "windowEndMin",
          "type": "u16"
        }
      ]
    },
    {
      "name": "withdrawUnallocated",
      "discriminator": [
        226,
        26,
        221,
        64,
        218,
        61,
        68,
        231
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "employer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "employer"
          ]
        },
        {
          "name": "ownerToken",
          "docs": [
            "Para onde volta o dinheiro (conta de token da empresa)."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "employee",
      "discriminator": [
        98,
        238,
        61,
        252,
        130,
        77,
        105,
        67
      ]
    },
    {
      "name": "employer",
      "discriminator": [
        34,
        80,
        59,
        57,
        83,
        119,
        213,
        106
      ]
    },
    {
      "name": "employerApproval",
      "discriminator": [
        75,
        91,
        63,
        5,
        178,
        70,
        148,
        30
      ]
    },
    {
      "name": "merchant",
      "discriminator": [
        71,
        235,
        30,
        40,
        231,
        21,
        32,
        64
      ]
    }
  ],
  "events": [
    {
      "name": "paymentMade",
      "discriminator": [
        227,
        251,
        123,
        16,
        133,
        220,
        83,
        242
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused",
      "msg": "Payments are paused"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Signer is not allowed to do this"
    },
    {
      "code": 6002,
      "name": "employeeInactive",
      "msg": "Employee is not active"
    },
    {
      "code": 6003,
      "name": "merchantInactive",
      "msg": "Merchant is not active"
    },
    {
      "code": 6004,
      "name": "exceedsMaxPerMeal",
      "msg": "Amount exceeds the per-meal limit"
    },
    {
      "code": 6005,
      "name": "exceedsDailyCap",
      "msg": "Amount exceeds the daily limit"
    },
    {
      "code": 6006,
      "name": "insufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6007,
      "name": "outsideTimeWindow",
      "msg": "Outside the allowed time window"
    },
    {
      "code": 6008,
      "name": "overAllocated",
      "msg": "Allocated balance would exceed deposited funds"
    },
    {
      "code": 6009,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6010,
      "name": "nameTooLong",
      "msg": "Name is too long"
    },
    {
      "code": 6011,
      "name": "invalidWindow",
      "msg": "Invalid time window"
    },
    {
      "code": 6012,
      "name": "employerNotApproved",
      "msg": "Company is not approved by Tabbit yet"
    },
    {
      "code": 6013,
      "name": "invalidMint",
      "msg": "Token is not the official benefit token"
    }
  ],
  "types": [
    {
      "name": "config",
      "docs": [
        "Seeds: [\"config\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "mint",
            "docs": [
              "Token oficial do benefício. Empresas só se cadastram com ele. Fica no fim da struct",
              "porque foi adicionado depois do primeiro deploy (ver set_mint, que migra a Config antiga)."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "employee",
      "docs": [
        "Seeds: [\"employee\", employer, wallet]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "employer",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "maxPerMeal",
            "type": "u64"
          },
          {
            "name": "dailyCap",
            "type": "u64"
          },
          {
            "name": "spentToday",
            "type": "u64"
          },
          {
            "name": "lastSpendDay",
            "type": "i64"
          },
          {
            "name": "windowStartMin",
            "docs": [
              "Minutos do dia (0..=1440). Ambos 0 = sem janela."
            ],
            "type": "u16"
          },
          {
            "name": "windowEndMin",
            "type": "u16"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "employer",
      "docs": [
        "Seeds: [\"employer\", owner]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "docs": [
              "ATA do `mint` cujo dono é este PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "tzOffsetMinutes",
            "docs": [
              "Fuso da empresa em minutos (Brasília = -180)"
            ],
            "type": "i16"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "totalAllocated",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "employerApproval",
      "docs": [
        "Seeds: [\"approval\", employer]. A empresa nasce pendente: só deposita e paga depois",
        "que a plataforma aprova (contrato, KYB, onboarding feitos fora da cadeia)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "employer",
            "type": "pubkey"
          },
          {
            "name": "approved",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "merchant",
      "docs": [
        "Seeds: [\"merchant\", wallet]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "category",
            "docs": [
              "0 = restaurant, 1 = cafe, 2 = grocery, 3 = other"
            ],
            "type": "u8"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentMade",
      "docs": [
        "Emitido a cada `pay`. O SDK lê este evento para montar o histórico."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "employer",
            "type": "pubkey"
          },
          {
            "name": "employee",
            "docs": [
              "wallet do funcionário"
            ],
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "docs": [
              "wallet do restaurante"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
