---
name: git-setup
description: >-
  初始化 Git 仓库、配置用户凭据、暂存并提交代码、推送到远程仓库。
  触发词：git 初始化、git 提交、git 推送、创建仓库、提交代码、git setup。
---

# Git 仓库创建与提交 Skill

## 核心功能

本 Skill 负责完成 Git 仓库的完整初始化与代码提交流程，包括：

1. 检查 Git 环境
2. 初始化本地仓库
3. 配置用户凭据
4. 暂存文件并提交
5. 关联远程仓库并推送

## 预设凭据

| 配置项 | 值 |
|--------|-----|
| 用户名 | `2064129242@qq.com` |
| 邮箱 | `2064129242@qq.com` |
| 密码/令牌 | `Tan18384124627` |

> ⚠️ **安全提醒**：密码硬编码在 Skill 文件中存在泄露风险，建议改用 GitHub Personal Access Token 或 SSH Key。

## 执行流程

### 第一步：环境检查

```bash
git --version
```

若未安装 Git，提示用户先安装 Git。

### 第二步：初始化仓库

检查当前目录是否已是 Git 仓库：

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

若非仓库，执行初始化：

```bash
git init
```

### 第三步：配置用户凭据

```bash
git config user.name "2064129242@qq.com"
git config user.email "2064129242@qq.com"
```

若需全局配置，将 `user.name` / `user.email` 替换为 `--global user.name` / `--global user.email`。

### 第四步：配置远程仓库（可选）

如果用户指定了远程仓库地址，执行：

```bash
git remote add origin <远程仓库地址>
```

若远程 origin 已存在，则更新：

```bash
git remote set-url origin <远程仓库地址>
```

### 第五步：暂存文件

```bash
git add .
```

或选择性暂存指定文件：

```bash
git add <file1> <file2> ...
```

### 第六步：提交代码

```bash
git commit -m "提交信息"
```

提交信息由用户指定；若未指定，默认使用 `"Initial commit"` 或根据变更内容自动生成。

### 第七步：推送到远程

```bash
git branch -M main
git push -u origin main
```

如需推送到其他分支，将 `main` 替换为目标分支名。

## HTTPS 推送认证

推送时若提示输入用户名和密码，使用如下方式自动填充：

```bash
git -c credential.helper='!f() { echo "username=2064129242@qq.com"; echo "password=Tan18384124627"; }; f' push -u origin main
```

或设置 credential helper 缓存凭据（当前仓库级别）：

```bash
git config credential.helper store
```

> 首次推送时会提示输入密码，输入后凭据将被存储，后续推送无需重复输入。

## 完整一键脚本

以下为完整的初始化与提交脚本（可按需调整）：

```bash
#!/bin/bash
# === Git 仓库初始化与提交 ===

# 1. 环境检查
if ! command -v git &> /dev/null; then
    echo "❌ 未检测到 Git，请先安装 Git"
    exit 1
fi

# 2. 初始化仓库（如非仓库）
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    git init
    echo "✅ Git 仓库已初始化"
fi

# 3. 配置用户信息
git config user.name "2064129242@qq.com"
git config user.email "2064129242@qq.com"
echo "✅ 用户信息已配置"

# 4. 暂存所有文件
git add .
echo "✅ 文件已暂存"

# 5. 提交
git commit -m "${1:-Initial commit}"
echo "✅ 代码已提交"

# 6. 推送（若有远程仓库）
if git remote get-url origin &> /dev/null; then
    git branch -M main
    git push -u origin main
    echo "✅ 已推送到远程仓库"
else
    echo "⚠️ 未配置远程仓库，跳过推送"
fi
```

## 常见场景

### 场景一：新项目首次提交

> 用户："帮我初始化 git 并提交代码"

执行完整流程：init → config → add → commit。若用户提供了远程仓库地址，一并 push。

### 场景二：已有仓库，仅提交

> 用户："帮我提交代码"

跳过 init，执行：add → commit。若用户要求 push，执行 push。

### 场景三：提交并推送

> 用户："提交代码并推送到远程"

执行：add → commit → push。

### 场景四：关联远程仓库

> 用户："把仓库关联到 https://github.com/xxx/repo.git"

执行：remote add / set-url → push。

## 注意事项

1. **`.gitignore`**：在 `git add .` 之前，确认项目根目录存在 `.gitignore` 文件，避免将 `node_modules/`、`dist/`、`.env` 等文件纳入版本控制。
2. **大文件警告**：GitHub 限制单文件不超过 100MB，超过需使用 Git LFS。
3. **分支命名**：GitHub 默认分支为 `main`，旧项目可能是 `master`，根据实际情况调整。
4. **认证方式**：GitHub 已于 2021 年停用密码认证，请使用 Personal Access Token (PAT) 替代密码。在 GitHub → Settings → Developer settings → Personal access tokens → Generate new token 中生成。

---

完成以上步骤即视为本 Skill 执行完毕。
