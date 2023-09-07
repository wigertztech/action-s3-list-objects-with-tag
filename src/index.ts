import * as AWS from "aws-sdk";
import * as core from "@actions/core";

const s3 = new AWS.S3();

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
      .promise()
      .then((result) => {
        const tags: { [key: string]: string } = {};
        for (const tag of result.TagSet) {
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
  keyName: string,
  keyValue: string
): Promise<GetTagsResult[]> {
  let searchResult: GetTagsResult[] = [];
  let continuationToken;
  do {
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 25,
    };
    const result = await s3.listObjectsV2(params).promise();
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
      if (!result.tags[`${keyName}`]) {
        continue;
      }
      if (result.tags[`${keyName}`] !== keyValue) {
        continue;
      }
      searchResult.push(result);
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

search(bucketName, tagKey, tagValue)
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
