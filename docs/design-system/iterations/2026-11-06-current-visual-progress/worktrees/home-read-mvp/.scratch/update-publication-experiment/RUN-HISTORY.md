# 候选与失败记录

最多三候选轮；旧实验run-01/02未重跑，也不计为本实验轮次。本实验仅一次协调者批准的轻量验证，不是重复基准。

|轮次|版本|执行|结果|保留证据|
|---|---|---|---|---|
|candidate-01|codeDigest 28b1b5bda18251af10638d0fc24b484671667b9edd2b3a92aac4216e200c237e|2026-10-29，--light一次|PASS，16.867秒，5478 checks，147 scopeChecks，12单次更新样本|results/candidate-01.json；archive/candidate-01；SNAPSHOT.json|
|candidate-02/03|未建立|未执行|NOT RUN|无|

TDD保留的失败先于对应实现，失败日志未覆盖：

|行为|RED证据|失败原因|GREEN证据|
|---|---|---|---|
|源/投影发布、回滚、版本、游标|results/tdd-core-red.txt|NOT_IMPLEMENTED，9项失败|results/tdd-core-green.txt，9项通过|
|双连接WAL与mixed负例|results/tdd-wal-red.txt|NOT_IMPLEMENTED|results/tdd-wal-green.txt，合计10项通过|
|私有路径/散列约束|results/tdd-runtime-red.txt|NOT_IMPLEMENTED|results/tdd-all-green.txt|
|独立源oracle与损坏投影负例|results/tdd-oracle-red.txt|NOT_IMPLEMENTED|results/tdd-all-green.txt|
|非ASCII排序键拒绝|results/tdd-order-red.txt|Missing expected exception|results/tdd-all-green.txt|
|metadata后提交、rows前屏障|results/tdd-metadata-barrier-red.txt|expected undefined != 3，缺失屏障证据|results/tdd-all-green.txt|

冻结前复核见results/final-tests.txt与results/syntax.txt。慢v1反例在已有实际CAS实现之上补充回归断言，通过本身不冒充新增RED轮次。运行器只做一次真实基数轻量验证；没有失败候选运行，没有删除任何失败日志。所有数据库只在worker私有.data目录，原冻结输入与代码引用哈希保存于candidate-01.json。
