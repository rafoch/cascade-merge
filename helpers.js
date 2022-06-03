function getReleaseData(branchName) {
    const versionRegex = new RegExp('^(?<mainBranch>.*)\\/(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$');
    const regexMatch = versionRegex.exec(branchName);

    if(!regexMatch) {
        return null;
    }

    const major = regexMatch.groups.major * 1;
    const minor = regexMatch.groups.minor * 1;
    const patch = regexMatch.groups.patch * 1;

    return { major, minor, patch }
}

export { getReleaseData };