# GitHub Action: S3 Object Tag Searcher

This GitHub Action allows you to search for S3 objects in a specified bucket based on their tags. You can optionally search for the latest object matching the tag criteria.

## Features:

- Search for S3 objects by tags.
- Option to return only the latest object by last modification date.
- Utilizes AWS SDK for Node.js.

## Usage:

1. **Setup AWS Credentials**

   Ensure that your GitHub Actions environment has access to your AWS S3 bucket. You can set the AWS credentials using the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables or any other preferred method.

2. **Configure the Action**

   Add the following steps to your GitHub Actions workflow:

   ```yaml
   steps:
     - name: Checkout
       uses: actions/checkout@v2

     - name: Search S3 by Tags
       uses: wigertztech/action-s3-list-objects-with-tag@v3
       env:
         BUCKET_NAME: "your-s3-bucket-name"
         # Add tags in this format
         TAGS: |
           key1=value1
           key2=value2
         # Optional: Set to true if you want the latest object only.
         LATEST_ONLY: "true"
   ```

3. **Retrieve the Results**

   After the action runs, the resulting S3 object's keys are available in the `objects` output variable. You can use this in subsequent steps in your workflow.

   ```yaml
   - name: Print S3 Object Keys
     run: echo "Matched S3 Objects: ${{ steps.previous_step_id.outputs.objects }}"
   ```

## Inputs:

- `BUCKET_NAME` (Required): Name of the S3 bucket to search in.
- `TAGS` (Required): A newline-separated string of tags in the format `key=value` that you want to match.
- `LATEST_ONLY` (Optional): If set to "true", only the latest object by last modification date that matches the tags will be returned. Default is "false".

## Outputs:

- `objects`: A JSON array of the S3 object keys that match the specified tags.

## Error Handling:

If there's an error during the search operation, the action will log the error and set the `objects` output to an empty array. The error message is also set to fail the action.

## Notes:

- Ensure the AWS user associated with the provided credentials has permissions to list and get tags of objects in the specified S3 bucket.
- The search is paginated, with a maximum of 25 objects fetched in each API call for efficiency.

## Dependencies:

- `@aws-sdk/client-s3`: AWS SDK for JavaScript in Node.js. Used for S3 operations.
- `@actions/core`: Core functions for GitHub Actions.
