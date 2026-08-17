# CS / AI 12 周学习打卡

在线访问：<https://duffyren.github.io/cs-ai-study-checkin/>

从 2026 年 8 月 17 日开始的 84 天学习计划，覆盖 Python、数据结构与算法、Python 项目、机器学习、LLM 与 Agent。

## 功能

- 今天：当日课程、具体任务、25 分钟专注计时和学习笔记
- 计划：按周查看 84 天安排并直接打卡
- 笔记：集中查看、搜索和继续编辑历史笔记
- 进度：查看总进度、连续学习、阶段进度和专注时长
- 同步：未登录时保存在本机；邮箱登录后自动跨设备同步
- 备份：支持 JSON 导入和导出

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

网页始终先把打卡、笔记和专注时长保存到当前浏览器。登录后，记录同时同步到 Supabase，并通过行级权限限制为仅当前账号可读写；断网修改会在恢复网络后继续同步。仍可随时导出 JSON 备份。

云端表结构和权限策略保存在 `supabase/schema.sql`。浏览器使用的是 Supabase 公共发布密钥，未包含数据库管理密钥。

## 产品参考

- [Iotawise](https://github.com/redpangilinan/iotawise)（MIT）：低负担打卡、连续完成与进度反馈
- [Super Productivity](https://github.com/super-productivity/super-productivity)（MIT）：专注计时和本地数据管理
- [DevTrail](https://github.com/hereisSwapnil/DevTrail)（MIT）：逐项学习笔记与 JSON 导入导出
- [roadmap.sh](https://github.com/nilbuild/developer-roadmap)（自定义许可）：结构化学习路径的产品思路

本项目针对固定的 84 天 CS / AI 学习计划独立实现，没有复制上述项目的界面或代码。
