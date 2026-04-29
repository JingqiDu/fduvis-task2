# Task2 前三题整理与整体分析

## 题目原文整理

### Level 1 challenge: Year/Month Heatmap

In this task, you need to draw a **Matrix View** to visualize the **Monthly Temperature** of Hong Kong, where the color of each matrix cell encodes the temperature. You can find the data in [temperature_daily.csv](./temperature_daily.csv).

Here are the basic requirements:

1. In the matrix, x direction indicates the year and y direction indicates the month (you can switch them if you like). Each cell indicates the corresponding month of a specific year.
2. You need to visualize the maximum and minimum temperature by month in some way (e.g. you can use click to switch max or min temperature).
3. When hovering mouse on each cell, a tip should appear to show the date and the temperature value.
4. A legend is needed to show the mapping between colors and values.

---

### Level 2 Challenge: Improvement of the Year/Month Heatmap

In Level 1, we have visualized the temperature differences across months and years. However, even within a month, the temperatures may vary drastically. In this task, you need to improve the previous visualization by showing the daily changes of temperature as well. You only need to focus on the last 5 to 10 years of data.

1. Same as level 1, x direction indicates the year and y direction indicates the month (you can switch them if you like). Each cell indicates the corresponding month of a specific year.
2. Still same as level 1, you need to visualize the daily changes of the maximum and minimum temperature in each cell.
3. In the mini line chart, x direction presents the days in a month, and y direction presents the temperature.
4. A legend is needed to show the mapping between colors and values.

---

### Level 3 challenge: Linkage between multiple view

This task focuses on visualizing the collaboration relationship between researchers. A JSON format data containing the collaboration records among professors in HKUST is provided. You can find the data in [HKUST_coauthor_graph.json](./HKUST_coauthor_graph.json). It consists of two parts: nodes and edges. The nodes represent professors and the edges are their corresponding collaborations.

You need to extract the subgraph of **CSE** (i.e., extract the collaboration subgraph consisting of all the professors from **CSE**), and visualize them in two forms: a node-link diagram and a matrix view.

Here are the basic requirements:

1. For the node-link diagram, the nodes indicate professors and the edges indicate collaborations. You are encouraged to use the force-directed layout provided by D3. The radii of nodes represent the total number of collaborators of each professor.
2. For the matrix view, the x and y direction indicate professors, and cells indicate the corresponding collaborations. You can use color or glyph to encode the total number of collaborations.
3. Linkage: when hovering the mouse on node in the node-link diagram, the corresponding column and row of the matrix view should be highlighted; when hovering on a cell in the matrix view, the corresponding nodes and edges should be highlighted as well.
4. You are encouraged to sort the matrix rows and columns and add animations to your implementation.

---

## 整体分析

这三题其实是在按 **D3 可视化能力** 逐步升级：

- **Level 1**：先学会把数据映射到图形上。
- **Level 2**：在已有图形单元里再塞入更细粒度的信息。
- **Level 3**：进入多视图联动，可视分析意味更强。

可以把它们理解成一条学习路径：

> 数据清洗与聚合 → 比例尺与编码 → SVG 绘制 → 交互 → 多视图联动

---

## 每题在练什么

### 1. Level 1 在练什么

核心是 **热力图 / 矩阵视图**。

你要掌握的点：

- 如何把 CSV 读进来
- 如何按“年-月”聚合数据
- 如何从 daily temperature 得到 monthly summary
- 如何用颜色编码数值
- 如何做 tooltip 和 legend

这题本质上是：

- **横轴** = 年
- **纵轴** = 月
- **一个格子** = 某年某月
- **颜色** = 温度值（最大值或最小值）

这是一道非常标准的 D3 入门题。

#### 难点

- 原始数据是 daily，不是 monthly，所以你必须先做聚合。
- 题目要求最大值和最小值都能看，说明你不能只算一个指标。
- tooltip 里要展示 date 和 temperature value，因此数据结构要提前设计好。

#### 建议实现方式

先做一个版本：

- 默认显示 monthly max temperature
- 点击按钮切换到 monthly min temperature

这样最稳。

---

### 2. Level 2 在练什么

核心是 **在热力图单元中嵌入迷你折线图（small multiples / glyph）**。

相比 Level 1，难度明显上升，因为现在：

- 一个格子不再只表示一个数
- 一个格子里要表示一个月内每天的变化
- 也就是说，一个 cell 里要放一条 mini line chart

#### 你要掌握的点

- 如何筛选最近 5~10 年数据
- 如何按“年-月”分组后保留 daily 序列
- 如何在每个 cell 内建立局部坐标系
- 如何用 D3 line generator 画迷你折线
- 如何处理每个月天数不同的问题（28/29/30/31）

#### 这题的本质变化

Level 1 是：

- 一个 cell 对应一个聚合值

Level 2 是：

- 一个 cell 对应一个时间序列

所以它是在训练你从“单值编码”升级到“局部结构编码”。

#### 难点

- 每个格子的宽高有限，折线会很密。
- 月份天数不同，横坐标要统一处理。
- 最大温度和最小温度可能要双线显示，或者切换显示。

#### 建议实现方式

最适合新手的方案：

- 只取最近 5 年或 8 年，先降低复杂度
- 每个 cell 中画两条线：max line 和 min line
- 用不同颜色区分 max / min
- legend 同时解释颜色含义

这样最直观，也最符合题目要求。

---

### 3. Level 3 在练什么

核心是 **图网络 + 矩阵视图 + 联动交互**。

这是三题里最像“可视分析系统”的一题。

你不仅要画图，还要考虑：

- 两种视图为什么要同时存在
- 它们各自适合看什么
- 如何通过 hover 把两个视图联动起来

#### 这题实际包含 4 个任务

1. 读入 coauthor graph JSON
2. 提取 CSE 子图
3. 画 node-link diagram
4. 画 matrix view，并实现双向 linkage

#### Node-link diagram 的作用

适合看：

- 谁和谁相连
- 网络结构是否聚集
- 哪些教授连接多

#### Matrix view 的作用

适合看：

- adjacency 是否清晰
- 连接密度如何
- 排序后是否有 cluster/block pattern

#### Linkage 的作用

这是题目最重要的分析价值所在：

- 鼠标放在节点上，看矩阵里对应行列
- 鼠标放在矩阵格上，看网络中对应边和节点

这样用户可以在“结构视图”和“精确视图”之间来回确认。

#### 难点

- 子图提取要先把 CSE 节点筛出来，再过滤边。
- force layout 要处理节点位置更新。
- matrix view 需要自己构造二维索引。
- linkage 需要统一 node id / name 映射。

#### 建议实现方式

最稳的路线：

- 先完成静态 node-link
- 再完成静态 matrix
- 再加单向 hover
- 最后补双向 linkage

不要一开始就把所有功能揉在一起。

---

## 三题的知识结构图

### D3 技能递进

1. **Level 1**
   - d3.csv
   - 数据聚合
   - scaleBand / scaleSequential
   - rect
   - tooltip
   - legend

2. **Level 2**
   - 嵌套数据结构
   - group by year-month
   - line generator
   - cell 内局部绘图
   - small multiples

3. **Level 3**
   - d3.json
   - graph filtering
   - forceSimulation
   - adjacency matrix
   - event linkage
   - highlight interaction

---

## 建议完成顺序

### 第一阶段：先做 Level 1

目标：做出一个能运行的 heatmap。

建议步骤：

1. 读 CSV
2. 解析日期
3. 聚合出 year-month max/min
4. 画坐标轴
5. 画矩形 cell
6. 上色
7. 加 tooltip
8. 加按钮切换 max/min
9. 加 legend

---

### 第二阶段：做 Level 2

目标：在 cell 里加 daily mini line chart。

建议步骤：

1. 只保留最近 5~10 年
2. 按 year-month 分组
3. 每组保留 daily records
4. 先画空 heatmap 网格
5. 在每个 cell 内插一个 mini svg/g group
6. 画 max/min line
7. 调整缩放与可读性
8. 加 legend

---

### 第三阶段：做 Level 3

目标：做出 network + matrix + linkage。

建议步骤：

1. 读 JSON
2. 筛出 CSE 节点
3. 过滤 CSE 之间的边
4. 计算每个节点 collaborator count
5. 画 force-directed graph
6. 构造 matrix 数据
7. 画 adjacency matrix
8. 给 node hover 加矩阵高亮
9. 给 matrix cell hover 加边和节点高亮
10. 最后再考虑排序和动画

---

## 新手最容易踩的坑

### Level 1

- 直接拿 daily 数据画 heatmap，导致一个月对应很多格
- 没先转 Date 对象，年和月取值混乱
- 颜色比例尺 domain 没设好，颜色区分不明显
- tooltip 不知道该绑定聚合前还是聚合后数据

### Level 2

- 每个 cell 内坐标系没独立，折线全画乱
- 月份天数不同，line generator 的 x 映射混乱
- 最近 10 年数据太挤，图面不可读

### Level 3

- node id 和 edge source/target 对不上
- force simulation 一直抖，但节点没正确更新位置
- matrix 行列索引不统一
- linkage 时只高亮了一边，另一边找不到映射

---

## 我对你接下来最推荐的策略

如果你是“逐步完成 task2”，我建议这样：

- **先只做 Level 1**，把最基础的 heatmap 跑通
- 我带你把数据结构、D3 代码框架、tooltip、legend 一步一步搭起来
- Level 1 稳了之后，再复用很多结构去做 Level 2
- 最后再进入 Level 3 的 graph + matrix 联动

因为这三题不是彼此独立的，前一题做好，后一题会轻松很多。

---

## 这个文档对应的源文件

- 题面来自 [level1.md](./level1.md)
- 题面来自 [level3.md](./level3.md)
- 参考示意图：
  - [level1.png](./level1.png)
  - [level2.png](./level2.png)
  - [level3.png](./level3.png)
