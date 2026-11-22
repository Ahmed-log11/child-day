# Demo video script (10–15 minutes, one take)

Fill in times while recording and copy them to `evaluation/ground_truth/test_video.csv`.

| # | Scene | Who | Expected detection |
|---|---|---|---|
| 1 | Watching TV, sitting still | Child 1 | `tv`, `still` |
| 2 | Picks up the tablet while TV stays on | Child 1 | `multi_screen` |
| 3 | Puts everything down, plays and moves around | Child 1 | `none`, `active` |
| 4 | On the phone on the sofa | Child 2 | `phone`, `still` |
| 5 | Walks into the kitchen zone | Child 1 | `danger_zone` alert |
| 6 | Staged fall onto a cushion | Child 2 | `fall` alert |
| 7 | Staged push, slow, no real contact | Both | `violent_contact` alert |
| 8 | Hug / handshake (should NOT alert) | Both | no alert |
| 9 | Long still period in front of the tablet | Child 1 | longest still period |

Everyone in the video must agree to be filmed. No real children without written parental consent, and that video never goes in the repo or the public deployment.
