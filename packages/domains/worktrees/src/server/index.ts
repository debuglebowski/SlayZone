export { getGitWatcher, closeGitWatcher } from './git-watcher'
export type { GitWatcher, GitWatcherEvents } from './git-watcher'
export {
  removeWorktree, createWorktree, runWorktreeSetupScript, runWorktreeSetupScriptSync,
  getCurrentBranch, isGitRepo, copyIgnoredFiles, getIgnoredFileTree,
  detectWorktrees, initRepo, listBranches, checkoutBranch, createBranch,
  hasUncommittedChanges, mergeIntoParent, abortMerge, startMergeNoCommit,
  isMergeInProgress, getConflictedFiles, getConflictContent, writeResolvedFile,
  commitFiles, getWorkingDiff, stageFile, unstageFile, discardFile, stageAll, unstageAll,
  getFileDiff, getUntrackedFileDiff, isRebaseInProgress, getRebaseProgress, abortRebase,
  continueRebase, skipRebaseCommit, getMergeContext, getRecentCommits, getAheadBehind,
  getAheadBehindUpstream, getStatusSummary, getRemoteUrl, gitFetch, gitPush, gitPull,
  getDefaultBranch, listBranchesDetailed, listRemoteBranches, getMergeBase,
  getCommitsSince, getCommitsBeforeRef, deleteBranch, pruneRemote, rebaseOnto,
  mergeFrom, getDiffStats, getWorktreeMetadata, getCommitDag, resolveChildBranches,
  initSubmodules, getResolvedCommitDag, getResolvedForkGraph, getResolvedUpstreamGraph,
  getResolvedRecentCommits, listStashes, createStash, applyStash, popStash, dropStash,
  branchFromStash, getStashDiff,
} from './git-worktree'
export {
  ensureColors,
  ensureColors as ensureWorktreeColors,
  getColor,
  getColor as getWorktreeColor,
  getProjectColors,
  getProjectColors as getProjectWorktreeColors,
  ensureProjectColors,
  ensureProjectColors as ensureProjectWorktreeColors,
} from './color-registry'
export { resolveCopyBehavior, resolveSubmoduleInitBehavior } from './copy-behavior'
export { listProjectRepos } from './list-project-repos'
export { runAiCommand } from './merge-ai'
export {
  checkGhInstalled, hasGithubRemote, listOpenPrs, getPrByUrl, createPr,
  getPrComments, addPrComment, mergePr, getPrDiff, getGhUser, editPrComment,
} from './gh-cli'
