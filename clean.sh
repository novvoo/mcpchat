#!/bin/bash

# 遍历 scripts 目录下的所有 .js 文件
for jsfile in scripts/*.js; do
    # 跳过不存在的情况（比如 scripts/ 为空）
    [ -e "$jsfile" ] || continue

    # 提取文件名（不含路径和 .js 扩展名）
    basename=$(basename "$jsfile" .js)

    echo "检查是否被引用: $basename"

    # 在当前目录（递归）所有文件中搜索该 basename
    # -l 表示只要找到就输出文件名，我们只关心是否找到
    if ! grep -r -l -F --exclude-dir='.git' --exclude-dir='node_modules' --exclude-dir='dist' --include="*" "$basename" . > /dev/null 2>&1; then
        echo "未被引用，删除: $jsfile"
        rm -f "$jsfile"
    else
        echo "已被引用，保留: $jsfile"
    fi
done