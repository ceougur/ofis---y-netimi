"""git diff çıktısından yalnız verilen sözcüğü içeren parçaları (hunk) bırakır: python3 -I hunk.py <sözcük> < diff > süzülmüş.diff"""
import sys

key = sys.argv[1]
text = sys.stdin.read()
head, _, rest = text.partition("\n@@")
hunks = ("@@" + rest).split("\n@@")
kept = [h if i == 0 else "@@" + h for i, h in enumerate(hunks) if key in h]
if not kept:
    sys.exit("parça yok")
out = head + "\n" + "\n".join(kept)
if not out.endswith("\n"):
    out += "\n"
sys.stdout.write(out)
