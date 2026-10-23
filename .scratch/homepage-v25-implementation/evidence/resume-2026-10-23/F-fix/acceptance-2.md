# F 当前指标补充：恢复第 2/3 轮独立接受

结论：PASS，仅纯财务接口。root 对冻结版本执行 13 文件 286 测试，全部通过；严格依赖范围类型和双文件 lint exit 0。独立反例覆盖过去期间与当前敞口隔离、未来成交不可见、带明确证据的做空/部分回补开放费用、部分 FX 保留逐账户原币。

当前源码 SHA256 `1e9757d35b09ade0debdc6ef08c6a49ffa78bb607383ce49d16efd5cbe79abf5`；测试 `fabfc2b43e6d57edc52177dcc950b83eaa4e54b5a3424e26de50fbf3ff34a921`。第1轮及历史证据69文件字节不变；补充manifest全部文件也重新核验匹配。

独立夹具校准中发现同日未完成日线/缺明确做空证据的预期无效，原失败日志保留；只修 root 夹具，产品始终冻结。详见 ../coordinator/F2-harness-diagnosis.md。

证据：../coordinator/F-acceptance-2-final-tests.log、F-acceptance-2-typecheck.log、F-acceptance-2-eslint.log、F-acceptance-2-manifest.json。

本次允许 P1 消费 currentMarketValue/currentUnrealized/currentOpenFees 及逐证券指标。日序列批量投影、归因、持久化、功能与视觉仍未接受。
