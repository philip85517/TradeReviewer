# Chart source repair manifest

Mode: **PREVIEW copies; canonical source untouched**

Contract checks:
- Missing-range diagonal yellow bridge removed from `chart-gap.svg`; vertical locator retained.
- Axis values at >=10,000 use two-decimal `万`; `chart-scale.svg` uses two-decimal `亿` and true zero `0`.
- `chart-gap.svg` and `period.svg` visible footer identity is `V2.4.1`; metadata provenance is unchanged.
- Full values and tooltip titles are unchanged.

| file | previous SHA-256 | repaired SHA-256 | byte delta |
|---|---|---|---:|
| `chart-gap.svg` | `951e2ce4641f595c744cf6eeb25b805ee865c2f2b1873c4c4728d479dedd94db` | `bf34df83d71d083fb87f092143e67d0c8e3a8b32a0673e9d4fccba4030c4c2b8` | 126 |
| `chart-hover--keyboard.svg` | `a90ce3547100588eb3a033e46c06f49e414e328828bd3823b9ce029f504624e9` | `c6c2a5245ceaeadd00e5a65c0037f1f2cf203d519cd80acbbf13bbb69f7f4d49` | -3 |
| `chart-hover.svg` | `856091744b956f37ab080494c46d5484d03ffa0c2fa91838d3034f0bac100b02` | `0ffd13dee12dfe0debceea03b7a4e230e2f9b3b455b90c4014c465be5b5bd1b7` | -3 |
| `chart-scale--extreme.svg` | `5a55263f83ded74305163dabe085d007ec5159c5dc373d1608acb6b4b45dfacc` | `cf0129188fed68d006b739a03adfca8eeb4ee50dd28e3747726da2f26e627180` | -3 |
| `chart-scale--normal.svg` | `5d4af3a400cf93317f5f4e9c99c7df245554462ecfd19d44349cc70023bebe35` | `7ee84e1e4aa57bcd8fa48bc348f93f10bb9e4ab21001cb283eaf5e6403bc80b0` | -3 |
| `chart-scale--wide.svg` | `f56a3becdc0abc70c2022f9cefd02e9703490f49d7cd0e5c1d4198ea92e4cd22` | `637d62153ec63126594a5ceb951b5a14fa477398e5aedef7a58dc39ebacb40d8` | -3 |
| `chart-scale.svg` | `5e5e4200cf8733e0c6a8f478bb9f15fb80e5dbdf5e7cfb6f1363493bd651f5b7` | `fdc1d06b7bf48f1f5f18ce4c3200e06ccb38a6430d7d181d0102ab556da3e9db` | -9 |
| `period.svg` | `9454786027b6d9c9875b5ee49f503557e58ae77d1c2584e168724c81a77b01f2` | `94567e47fa84e7d41b9eb739abc0892da4e9975bf003bb71149fd003fdf5304a` | -5 |
