import { ListObjectsV2CommandInput, S3 } from "@aws-sdk/client-s3";
import * as core from "@actions/core";

const s3 = new S3();

interface SeatchParams {
  bucketName: string;
  tagKey: string;
  tagValue: string;
  tagKeyisRegex: boolean;
  tagValueisRegex: boolean;
}

interface MatchParams {
  tags: { [key: string]: string };
  tagKey: string;
  tagValue: string;
  tagKeyisRegex: boolean;
  tagValueisRegex: boolean;
}

interface GetTagsResult {
  objectKey: string;
  tags: { [key: string]: string };
}

async function getTags(
  bucketName: string,
  objectKey: string
): Promise<GetTagsResult> {
  return new Promise((resolve, reject) => {
    s3.getObjectTagging({
      Bucket: bucketName,
      Key: objectKey,
    })
      .then((result) => {
        const tags: { [key: string]: string } = {};
        if (!result.TagSet) {
          return reject(new Error("getTags: no tags set"));
        }
        for (const tag of result.TagSet) {
          if (!tag.Key || !tag.Value) {
            continue;
          }
          tags[tag.Key] = tag.Value;
        }
        resolve({
          objectKey,
          tags,
        });
      })
      .catch((err) => {
        console.error(`getTags: ${bucketName}/${objectKey} failed`);
        reject(err);
      });
  });
}

async function getTagsBatch(
  bucketName: string,
  objectKeys: string[]
): Promise<GetTagsResult[]> {
  const jobs = [];
  for (const key of objectKeys) {
    jobs.push(getTags(bucketName, key));
  }
  return Promise.all(jobs);
}

function hasMatch({
  tags,
  tagKey,
  tagValue,
  tagKeyisRegex,
  tagValueisRegex,
}: MatchParams): boolean {
  for (const key of Object.keys(tags)) {
    if (key !== tagKey) {
      continue;
    }
    if (tags[`${key}`] !== tagValue) {
      continue;
    }
    return true;
  }
  return false;
}

async function search({
  bucketName,
  tagKey,
  tagValue,
  tagKeyisRegex,
  tagValueisRegex,
}: SeatchParams): Promise<GetTagsResult[]> {
  let searchResult: GetTagsResult[] = [];
  let continuationToken;
  do {
    const params: ListObjectsV2CommandInput = {
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 25,
    };
    const result = await s3.listObjectsV2(params);
    if (!result || !result.Contents) {
      throw new Error("result.Contents not set");
    }

    const objectKeys: string[] = [];
    for (const obj of result.Contents) {
      if (obj.Key) {
        objectKeys.push(obj.Key);
      }
    }

    for (const result of await getTagsBatch(bucketName, objectKeys)) {
      const params: MatchParams = {
        tags: result.tags,
        tagKey,
        tagValue,
        tagKeyisRegex,
        tagValueisRegex,
      };
      if (hasMatch(params)) {
        searchResult.push(result);
      }
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return searchResult;
}

const bucketName = process.env.BUCKET_NAME;
if (!bucketName) {
  throw new Error("The BUCKET_NAME environment variable is not set.");
}

const tagKey = process.env.TAG_KEY;
if (!tagKey) {
  throw new Error("The TAG_KEY environment variable is not set.");
}

const tagValue = process.env.TAG_VALUE;
if (!tagValue) {
  throw new Error("The TAG_VALUE environment variable is not set.");
}

const tagKeyisRegex =
  process.env.TAG_KEY_IS_REGEX?.toLocaleLowerCase() === "true" || false;

const tagValueisRegex =
  process.env.TAG_VALUE_IS_REGEX?.toLocaleLowerCase() === "true" || false;

search({
  bucketName,
  tagKey,
  tagValue,
  tagKeyisRegex,
  tagValueisRegex,
})
  .then((result) => {
    const objects: string[] = [];
    for (const object of result) {
      objects.push(object.objectKey);
    }
    core.setOutput("objects", JSON.stringify(objects));
  })
  .catch((error) => {
    console.error("Error occurred:", error);
    core.setOutput("objects", JSON.stringify([]));
    core.setFailed(error.message);
  });
