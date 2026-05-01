import { simpleGit } from "npm:simple-git";

export const read = async (path: string, root?: string) => {
  const git = simpleGit({ baseDir: root });

  const log = await git.log({ file: path });

  return {
    content: await git.show("HEAD:" + path),
    modifiedTime: log.latest ? new Date(log.latest.date) : null,
    creationTime: log.all.length ? new Date(log.all.at(-1)!.date) : null,
  };
};
