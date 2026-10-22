# Current source static verification

Read-only check run after the coordinator's source repair. The check compares each working-tree SVG byte-for-byte with the output of the guarded repair function applied to the original `HEAD` bytes. It also checks dimensions, title preservation, axis text, the chart-gap locator/bridge, and visible footers.

| file | original HEAD SHA-256 | current SHA-256 | viewport | result |
|---|---|---|---:|---|
| `chart-gap.svg` | `951e2ce4641f595c744cf6eeb25b805ee865c2f2b1873c4c4728d479dedd94db` | `bf34df83d71d083fb87f092143e67d0c8e3a8b32a0673e9d4fccba4030c4c2b8` | 1100×1000 | PASS |
| `chart-hover--keyboard.svg` | `a90ce3547100588eb3a033e46c06f49e414e328828bd3823b9ce029f504624e9` | `c6c2a5245ceaeadd00e5a65c0037f1f2cf203d519cd80acbbf13bbb69f7f4d49` | 1100×350 | PASS |
| `chart-hover.svg` | `856091744b956f37ab080494c46d5484d03ffa0c2fa91838d3034f0bac100b02` | `0ffd13dee12dfe0debceea03b7a4e230e2f9b3b455b90c4014c465be5b5bd1b7` | 1100×350 | PASS |
| `chart-scale--extreme.svg` | `5a55263f83ded74305163dabe085d007ec5159c5dc373d1608acb6b4b45dfacc` | `cf0129188fed68d006b739a03adfca8eeb4ee50dd28e3747726da2f26e627180` | 1100×380 | PASS |
| `chart-scale--normal.svg` | `5d4af3a400cf93317f5f4e9c99c7df245554462ecfd19d44349cc70023bebe35` | `7ee84e1e4aa57bcd8fa48bc348f93f10bb9e4ab21001cb283eaf5e6403bc80b0` | 1100×380 | PASS |
| `chart-scale--wide.svg` | `f56a3becdc0abc70c2022f9cefd02e9703490f49d7cd0e5c1d4198ea92e4cd22` | `637d62153ec63126594a5ceb951b5a14fa477398e5aedef7a58dc39ebacb40d8` | 1100×380 | PASS |
| `chart-scale.svg` | `5e5e4200cf8733e0c6a8f478bb9f15fb80e5dbdf5e7cfb6f1363493bd651f5b7` | `fdc1d06b7bf48f1f5f18ce4c3200e06ccb38a6430d7d181d0102ab556da3e9db` | 1100×380 | PASS |
| `period.svg` | `9454786027b6d9c9875b5ee49f503557e58ae77d1c2584e168724c81a77b01f2` | `4fbe2cdd0d411a25adc92c555784c09b82eabcd5927691edab01aca70e31b6d8` | 1100×1100 | PASS |

## Findings

- PASS: all eight current SVGs exactly match the guarded repair output; no unexpected geometry/text edits were detected.
- `chart-gap.svg`: the diagonal yellow bridge is absent; the vertical dashed locator remains.
- `chart-scale.svg`: visible labels are `2.00亿`, `1.00亿`, `0`, `-1.00亿`, `-2.00亿`.
- Other seven images: visible >=10,000 ticks use `2.00万`, `1.50万`, `1.00万`; `5,000` remains below threshold.
- `chart-gap.svg` and `period.svg`: visible footer is `V2.4.1`; metadata provenance and title nodes are unchanged.

This is source/text and static geometry verification. Browser/CUA interaction, hover, keyboard focus, and date control behavior remain outside this check.
