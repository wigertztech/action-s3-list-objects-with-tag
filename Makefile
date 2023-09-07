IMAGE_NAME = $(notdir $(CURDIR))

.PHONY: build
build:
	DOCKER_CLI_HINTS=false docker build -t $(IMAGE_NAME):latest .

.PHONY: run
run:
	docker run --rm \
		-v ${HOME}/.aws:/home/node/.aws \
		-e AWS_REGION \
		-e BUCKET_NAME \
		-e TAG_KEY \
		-e TAG_VALUE \
		--name $(IMAGE_NAME) \
		$(IMAGE_NAME):latest

.PHONY: all
all: build run
