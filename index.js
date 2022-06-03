const core = require('@actions/core');
const github = require('@actions/github');

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

async function run() {
    try {
        const branchRefName = core.getInput('branch');
        const repoNameWithOwner = core.getInput('repo');    
        const repoOwner = core.getInput('owner');    
        const token = core.getInput('token');
        const repoName = repoNameWithOwner.replace(`${repoOwner}/`, '');

        const octokit = new github.GitHub(token);


        const branchName = branchRefName.replace('refs/', '').replace('heads/', '');
    
        console.log(`Current repo name: ${repoName}`);
        console.log(`Current repo owner: ${repoOwner}`);
        console.log(`Current branch name: ${branchName}`);
    
        const branchData = getReleaseData(branchName);
    
        if(!branchData) {
            console.log('Not need cascade merge');
            return;
        }

        const response = await octokit.git.listMatchingRefs({
            owner: repoOwner,
            repo: repoName,
            ref: 'heads/release',
            per_page: 100
        });        

        let branchNames = response.data
            .filter(d => !!d.ref)
            .map(d => d.ref.replace('refs/', '').replace('heads/', ''))
            .filter(d => {         
                const data = getReleaseData(d);

                if(data === null) {
                    return false;
                }

                if(data.major == branchData.major && data.minor == branchData.minor && data.patch > branchData.patch) {
                    return true;
                }

                if(data.major == branchData.major && data.minor > branchData.minor) {
                    return true;
                }                

                if(data.major > branchData.major) {
                    return true;
                }

                return false;
            })
            .sort((da, db) => {
                const a = getReleaseData(da);
                const b = getReleaseData(db);

                if(a.major > b.major) {
                  return 1;
                }
              
                if(a.major == b.major && a.minor > b.minor) {
                  return 1;
                }
              
                if(a.major == b.major && a.minor == b.minor && a.patch > b.patch) {
                  return 1;
                }
              
                return -1;
            });

        const branchNamesToMerge = [...branchNames, 'master'];
        let mergedBranch = branchName;

        for(const branchNameToMerge of branchNamesToMerge) {
            const commitName = `Automatic merge from branch ${mergedBranch} into ${branchNameToMerge}`;
            const base = `refs/heads/${branchNameToMerge}`;
            const head = `refs/heads/${mergedBranch}`;

            const mergePayload = {
                owner: repoOwner,
                repo: repoName,
                base,
                head,
                commit_message: commitName
            };

            let response = null;
            try {
                response  = await octokit.repos.merge(mergePayload);
            }
            catch(error) {
                console.log(JSON.stringify(response));
                console.log(JSON.stringify(error));
                if(error.status == 409) {
                    const failurePullRequestName = `Automatic merge failure from branch ${mergedBranch} into ${branchNameToMerge}`;

                    await octokit.pulls.create({
                        owner: repoOwner,
                        repo: repoName,
                        title: failurePullRequestName,
                        body: failurePullRequestName,
                        head,
                        base,
                    });

                    throw new Error(`Error while merge branch ${mergedBranch} into ${branchNameToMerge}`);
                }
            }            

            mergedBranch = branchNameToMerge;
        }

        console.log('Operation completed');
    } catch (error) {
        core.setFailed(error.toString());
    }    
}

run();