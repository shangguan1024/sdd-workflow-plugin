import { Phase } from "../state.js";
import { existsSync } from "fs";
import { join } from "path";
const REQUIRED_REVIEW_ARTIFACTS = [
    "docs/features/{feature}/reviews/architecture_review.md",
    "docs/features/{feature}/reviews/code_quality_review.md",
];
const REQUIRED_MEMORY_ARTIFACTS = ["PROJECT_STATE.md", "AGENTS.md"];
export const artifactCheckMiddleware = {
    check(phase, state, projectDir) {
        if (phase === Phase.PERSISTENCE) {
            // Phase 6 (PERSISTENCE) 才要求 review 已存在；Phase 5 (REVIEW) 是「生成」review 的地方，不能要求已存在（否则死锁）
            const missing = [];
            for (const pattern of REQUIRED_REVIEW_ARTIFACTS) {
                const path = pattern.replace("{feature}", state.featureName);
                if (!existsSync(join(projectDir, path))) {
                    missing.push(path);
                }
            }
            if (missing.length > 0) {
                return {
                    allowed: false,
                    message: `Missing ${missing.length} review artifacts: ${missing.join(", ")}`,
                    missing,
                };
            }
        }
        if (phase === Phase.PERSISTENCE) {
            const missing = [];
            for (const artifact of REQUIRED_MEMORY_ARTIFACTS) {
                if (!existsSync(join(projectDir, artifact))) {
                    missing.push(artifact);
                }
            }
            if (missing.length > 0) {
                return {
                    allowed: false,
                    message: `Missing memory artifacts: ${missing.join(", ")}`,
                    missing,
                };
            }
        }
        return { allowed: true };
    },
};
//# sourceMappingURL=artifact-check.js.map