#!/bin/bash
# Eski kod kopyası (ders 23): 5ee4d99e — git archive (docs/kanit hariç) + node_modules bağı.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag/eski
mkdir -p $E || exit 1
cd $W || exit 1
git archive 5ee4d99e ':!docs/kanit' | tar -x -C $E || exit 1
ln -sfn /home/user/ofis---y-netimi/node_modules $E/node_modules
ls $E | head -30 | tr '\n' ' '
du -sh $E
