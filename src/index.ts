import { ListObjectsV2CommandInput, S3 } from "@aws-sdk/client-s3";
import * as core from "@actions/core";

const s3 = new S3();

interface Tags {
  [key: string]: string;
}

interface GetTagsResult {
  objectKey: string;
  tags: Tags;
}

function stringToTags(str: string): Tags {
  const lines = str.split("\n").filter((line) => line.trim() !== "");
  const tags: Tags = {};
  for (const line of lines) {
    const parts = line.split("=");
    if (parts.length >= 2) {
      tags[`${parts[0]}`] = `${parts[1]}`;
    }
  }
  return tags;
}

function isMatchingTags(objectTags: Tags, targetTags: Tags): boolean {
  for (const targetTagsKey of Object.keys(targetTags)) {
    if (!objectTags[targetTagsKey]) {
      return false;
    }
    if (objectTags[targetTagsKey] !== targetTags[targetTagsKey]) {
      return false;
    }
  }
  return true;
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

async function search(
  bucketName: string,
  tags: Tags,
  latest: boolean
): Promise<GetTagsResult[]> {
  let searchResult: GetTagsResult[] = [];
  let continuationToken;
  let latestDate: Date | undefined;
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

    let objectKeys: string[] = [];
    for (const obj of result.Contents) {
      if (!obj.Key) {
        continue;
      }
      if (!latest) {
        objectKeys.push(obj.Key);
        continue;
      }
      if (!obj.LastModified) {
        continue;
      }
      if (!latestDate) {
        latestDate = obj.LastModified;
        objectKeys = [obj.Key];
        continue;
      }
      if (obj.LastModified >= latestDate) {
        latestDate = obj.LastModified;
        objectKeys = [obj.Key];
      }
    }

    for (const result of await getTagsBatch(bucketName, objectKeys)) {
      if (isMatchingTags(result.tags, tags)) {
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

const latest = process.env.LATEST_ONLY === "true" || false;

const tags = stringToTags(process.env.TAGS || "");
if (Object.keys(tags).length == 0) {
  throw new Error("No tags set");
}

search(bucketName, tags, latest)
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
