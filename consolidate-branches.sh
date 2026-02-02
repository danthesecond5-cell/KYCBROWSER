#!/bin/bash

# Simple Branch Consolidation Script

MERGE_LOG="/workspace/merge-results.txt"
echo "Branch Consolidation Started: $(date)" > "$MERGE_LOG"
echo "========================================" >> "$MERGE_LOG"

SUCCESSFUL=0
FAILED=0
SKIPPED=0

# Get all branches to merge
BRANCHES=(
    "copilot/error-check-code-basics"
    "copilot/setup-copilot-instructions"
    "copilot/sub-pr-23"
    "cursor/advanced-protocol-system-09c2"
    "cursor/advanced-protocol-system-e4f3"
    "cursor/aowlevel-script-expo-compatibility-9e8e"
    "cursor/application-setup-9177"
    "cursor/application-stability-f4d4"
    "cursor/automated-branch-consolidation-0f13"
    "cursor/automated-branch-consolidation-c20a"
    "cursor/background-process-setup-3bdc"
    "cursor/background-process-setup-9871"
    "cursor/background-process-setup-d55f"
    "cursor/branch-consolidation-4fce"
    "cursor/branch-consolidation-9d03"
    "cursor/branch-consolidation-and-resolve-1e64"
    "cursor/branch-consolidation-and-resolve-441e"
    "cursor/branch-consolidation-and-resolve-4d9f"
    "cursor/branch-consolidation-and-resolve-81c5"
    "cursor/branch-consolidation-and-resolve-94f7"
    "cursor/branch-consolidation-and-resolve-a289"
    "cursor/branch-merge-resolution-04b1"
    "cursor/branch-merge-resolution-1341"
    "cursor/branch-merge-resolution-4099"
    "cursor/branch-merge-resolution-62e3"
    "cursor/branch-merge-resolution-840d"
    "cursor/branch-merge-resolution-8c12"
    "cursor/branch-merge-resolution-daea"
    "cursor/branch-merge-resolution-e8c8"
    "cursor/camera-permission-simulation-options-2a49"
    "cursor/camera-permission-video-simulation-21c0"
    "cursor/camera-permission-video-simulation-f2d3"
    "cursor/codebase-bug-fixes-02f3"
    "cursor/codebase-bug-fixes-0e59"
    "cursor/code-fundamentals-review-02d4"
    "cursor/code-fundamentals-review-73ea"
    "cursor/code-fundamentals-review-f908"
    "cursor/error-handling-and-code-quality-6cc6"
    "cursor/extensive-testing-and-resolution-b2a6"
    "cursor/injection-protocol-enhancements-00e6"
    "cursor/injection-protocol-enhancements-12ac"
    "cursor/injection-protocol-enhancements-5182"
    "cursor/injection-protocol-enhancements-6543"
    "cursor/injection-protocol-enhancements-657a"
    "cursor/injection-protocol-enhancements-68a7"
    "cursor/injection-protocol-enhancements-85ba"
    "cursor/injection-protocol-enhancements-c7ce"
    "cursor/injection-protocol-enhancements-e2d6"
    "cursor/injection-protocol-system-18ff"
    "cursor/injection-protocol-system-6cd8"
    "cursor/injection-protocol-system-7072"
    "cursor/injection-protocol-system-91ad"
    "cursor/injection-protocol-system-f37b"
    "cursor/kyc"
    "cursor/missing-task-description-ac1f"
    "cursor/mobile-protocol-evaluation-9668"
    "cursor/my-videos-page-freeze-db08"
    "cursor/prototype-presentation-protocols-f46f"
    "cursor/prototype-presentation-readiness-bd47"
    "cursor/video-overlay-protocols-0040"
    "cursor/video-overlay-protocols-4b2b"
    "cursor/video-overlay-protocols-c7f3"
    "cursor/webcam-test-injection-1423"
    "cursor/webcam-test-injection-a9ad"
    "cursor/webcam-test-injection-d44c"
    "devmode/tests-ci"
)

echo "Total branches to process: ${#BRANCHES[@]}" | tee -a "$MERGE_LOG"
echo "" | tee -a "$MERGE_LOG"

for branch in "${BRANCHES[@]}"; do
    echo "Processing: $branch" | tee -a "$MERGE_LOG"
    
    # Check if branch exists
    if ! git rev-parse "origin/$branch" > /dev/null 2>&1; then
        echo "  SKIP: Branch does not exist" | tee -a "$MERGE_LOG"
        ((SKIPPED++))
        continue
    fi
    
    # Check if already merged
    MERGE_BASE=$(git merge-base HEAD "origin/$branch" 2>/dev/null || echo "none")
    BRANCH_COMMIT=$(git rev-parse "origin/$branch" 2>/dev/null || echo "none")
    
    if [ "$MERGE_BASE" = "$BRANCH_COMMIT" ]; then
        echo "  SKIP: Already merged" | tee -a "$MERGE_LOG"
        ((SKIPPED++))
        continue
    fi
    
    # Attempt merge
    if git merge "origin/$branch" --no-edit --no-ff -m "Consolidate: merge $branch" > /dev/null 2>&1; then
        echo "  SUCCESS: Clean merge" | tee -a "$MERGE_LOG"
        ((SUCCESSFUL++))
    else
        # Check for conflicts
        if git status | grep -q "Unmerged paths"; then
            echo "  CONFLICT: Resolving with ours strategy" | tee -a "$MERGE_LOG"
            git checkout --ours . > /dev/null 2>&1
            git add . > /dev/null 2>&1
            git commit --no-edit -m "Consolidate: merge $branch (conflicts resolved)" > /dev/null 2>&1
            ((SUCCESSFUL++))
        else
            echo "  FAILED: Could not merge" | tee -a "$MERGE_LOG"
            git merge --abort > /dev/null 2>&1 || true
            ((FAILED++))
        fi
    fi
    
    echo "" | tee -a "$MERGE_LOG"
done

# Summary
echo "========================================" | tee -a "$MERGE_LOG"
echo "Consolidation Complete: $(date)" | tee -a "$MERGE_LOG"
echo "========================================" | tee -a "$MERGE_LOG"
echo "Total branches: ${#BRANCHES[@]}" | tee -a "$MERGE_LOG"
echo "Successfully merged: $SUCCESSFUL" | tee -a "$MERGE_LOG"
echo "Already merged/Skipped: $SKIPPED" | tee -a "$MERGE_LOG"
echo "Failed: $FAILED" | tee -a "$MERGE_LOG"
echo "" | tee -a "$MERGE_LOG"

exit 0
