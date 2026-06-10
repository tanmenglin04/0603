---
name: git-setup
description: >-
  初始化 Git 仓库、配置用户凭据、暂存并提交代码、创建 GitHub 远程仓库并推送。
  触发词：git 初始化、git 提交、git 推送、创建仓库、提交代码、git setup、上传 github。
---

# Git 仓库创建与提交 + GitHub 上传 Skill

## 核心功能

本 Skill 负责完成 Git 仓库的**完整初始化 → 提交 → GitHub 上传**流程：

1. 检查 Git 环境
2. 初始化本地仓库
3. 配置用户凭据
4. 暂存文件并提交
5. **在 GitHub 上创建远程仓库（通过 gh CLI 或引导用户手动创建）**
6. **关联远程仓库并推送代码到 GitHub**

## 预设凭据

| 配置项 | 值 |
|--------|-----|
| Git 用户名 | `linzi` |
| Git 邮箱 | `2064124627@qq.com` |
| GitHub 用户名 | `tanmenglin04` |
| GitHub 令牌 (PAT) | `<你的 GitHub PAT>` |

> ⚠️ **安全提醒**：令牌硬编码在 Skill 文件中存在泄露风险，不要将此文件提交到公开仓库。

## 执行流程

---

### 第一步：环境检查

```bash
git --version
gh --version 2>/dev/null || echo "gh not available"
```

- Git 必须已安装
- `gh` CLI 可选（用于自动创建仓库）；如果没有，将引导用户手动操作

---

### 第二步：初始化仓库

检查当前目录是否已是 Git 仓库：

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

若非仓库，执行初始化：

```bash
git init
```

---

### 第三步：配置用户凭据

```bash
git config user.name "linzi"
git config user.email "2064124627@qq.com"
```

---

### 第四步：确认 .gitignore

在暂存前确认 `.gitignore` 存在且覆盖了 `node_modules/`、`dist/`、`*.local`、`.env` 等条目。

若不存在，创建一个包含常见忽略规则的文件。

---

### 第五步：暂存文件

```bash
git add -A
```

使用 `-A` 而非 `.`，确保捕获删除和重命名操作。`.gitignore` 会自动生效。

---

### 第六步：提交代码

```bash
git commit -m "<提交信息>"
```

提交信息默认使用 `"chore: initial commit"`，用户可自定义。

---

### 第七步：创建 GitHub 远程仓库

#### 方式 A：使用 gh CLI（优先）

检查 `gh` CLI 是否可用且已登录：

```bash
gh auth status
```

若可用，直接创建仓库并获取 URL：

```bash
# 获取当前目录名作为仓库名
REPO_NAME=$(basename "$(pwd)")
gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
```

参数说明：
- `--private`：私有仓库；如需公开用 `--public`
- `--source=.`：使用当前本地仓库
- `--remote=origin`：自动添加 origin 远程
- `--push`：创建后自动推送
- 若使用 `--push`，则第八步可跳过

#### 方式 B：使用 curl + GitHub API（无 gh CLI 时）

先验证令牌有效：

```bash
curl -s -H "Authorization: token <PAT>" \
  "https://api.github.com/user" | grep '"login"'
```

创建公开仓库：

```bash
curl -s -H "Authorization: token <PAT>" \
  -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"<repo-name>\",\"description\":\"<desc>\",\"private\":false}" \
  "https://api.github.com/user/repos"
```

- `private: false` → 公开仓库；`true` → 私有仓库
- 成功后返回 JSON，其中 `html_url` 即 GitHub 页面地址

#### 方式 C：引导用户手动创建

若以上两种方式均不可用，引导用户：

1. 打开 https://github.com/new
2. 填写项目名，选择 Private/Public
3. **不要**勾选 README / .gitignore / license
4. 创建后把仓库地址发给 Claude

---

### 第八步：关联远程仓库（仅方式 B）

```bash
# 添加远程仓库（如果还没有）
git remote add origin <仓库地址>

# 或更新已有的 origin
git remote set-url origin <仓库地址>
```

验证：

```bash
git remote -v
```

---

### 第九步：推送到 GitHub

#### 确定当前分支名：

```bash
git branch --show-current
```

#### 关联远程仓库（推荐：令牌嵌入 URL，免密推送）

```bash
git remote add origin "https://<PAT>@github.com/<用户名>/<仓库名>.git"
# 例如：
git remote add origin "https://ghp_xxx@github.com/tanmenglin04/my-project.git"
```

若 origin 已存在：

```bash
git remote set-url origin "https://<PAT>@github.com/<用户名>/<仓库名>.git"
```

#### 推送

```bash
git push -u origin <分支名>
```

无需额外认证，令牌已在 URL 中。

---

## 完整一键流程总结

```
┌─────────────────────────────────────────────────┐
│  1. git init          ← 初始化本地仓库            │
│  2. git config         ← 配置用户名和邮箱          │
│  3. git add -A         ← 暂存所有文件             │
│  4. git commit -m "…"  ← 提交代码                 │
│  5. 创建 GitHub 仓库   ← gh CLI 或手动创建         │
│  6. git remote add     ← 关联远程仓库             │
│  7. git push -u origin ← 推送到 GitHub            │
└─────────────────────────────────────────────────┘
```

---

## 常见场景

### 场景一：新项目初始化并上传 GitHub

> 用户："帮我初始化 git 并上传到 GitHub"

执行完整 1→7 流程。若 gh 可用则自动创建仓库；否则引导用户手动创建后继续。

### 场景二：已有本地仓库，仅上传 GitHub

> 用户："帮我把代码上传到 GitHub"

跳过 init，从第 7 步开始（创建仓库 → remote add → push）。

### 场景三：已有远程仓库，仅提交推送

> 用户："提交代码并推送"

执行：add → commit → push。

### 场景四：更换远程仓库地址

> 用户："把仓库关联到新的 GitHub 地址"

执行：`git remote set-url origin <新地址>` → push。

---

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| `remote origin already exists` | 已有关联的远程仓库 | 用 `git remote set-url origin <新地址>` 更新 |
| `Authentication failed` | 令牌错误或过期 | 检查 GitHub PAT 是否有效，重新生成 |
| `failed to push some refs` | 远程有本地不存在的提交 | `git pull --rebase origin <分支>` 后再 push |
| `src refspec master does not match any` | 还没有任何 commit | 先执行 `git commit` |
| `Permission denied (publickey)` | SSH Key 未配置 | 改用 HTTPS + PAT 方式 |

---

## 注意事项

1. **`.gitignore` 优先**：`git add` 前确保 `.gitignore` 已配置好，`node_modules/`、`dist/`、`.env` 等绝不能提交。
2. **大文件限制**：GitHub 单文件不超过 100 MB，超过需使用 Git LFS。
3. **分支命名**：新 GitHub 仓库默认分支为 `main`，`git init` 默认为 `master`，推送时以本地分支名为准。
4. **Token 权限**：Personal Access Token 至少需要 `repo` 权限。GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)。
5. **私有 vs 公开**：默认创建私有仓库，如需公开需明确指定。

---

完成以上步骤即视为本 Skill 执行完毕。
