# CS / AI 12 周学习打卡

在线访问：<https://duffyren.github.io/cs-ai-study-checkin/>

从 2026 年 8 月 17 日开始的 84 天学习计划，覆盖 Python、数据结构与算法、Python 项目、机器学习、LLM 与 Agent。

## 功能

- 今天：当日课程、具体任务、25 分钟专注计时和学习笔记
- 计划：按周查看 84 天安排并直接打卡
- 笔记：集中查看、搜索和继续编辑历史笔记
- 进度：查看总进度、连续学习、阶段进度和专注时长
- 数据：在当前浏览器本地保存，支持 JSON 导入和导出

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

检查可发布版本：

```bash
npm test
```

构建结果生成在 `dist/`。

## 数据与隐私

打卡、笔记和专注时长只保存在当前浏览器的 `localStorage` 中，不会上传到服务器。清理浏览器数据或更换设备前，可以先从网页导出 JSON 备份。

## 产品参考

- [Iotawise](https://github.com/redpangilinan/iotawise)（MIT）：低负担打卡、连续完成与进度反馈
- [Super Productivity](https://github.com/super-productivity/super-productivity)（MIT）：专注计时和本地数据管理
- [DevTrail](https://github.com/hereisSwapnil/DevTrail)（MIT）：逐项学习笔记与 JSON 导入导出
- [roadmap.sh](https://github.com/nilbuild/developer-roadmap)（自定义许可）：结构化学习路径的产品思路

本项目针对固定的 84 天 CS / AI 学习计划独立实现，没有复制上述项目的界面或代码。
