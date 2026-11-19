import {
  CfnOutput,
  RemovalPolicy,
  Size,
  Stack,
  Tags,
  type StackProps,
} from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

const PRODUCTION_REGION = "us-east-1";

export class ProductionStack extends Stack {
  public constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    if (this.region !== PRODUCTION_REGION) {
      throw new Error(
        `FinHand production must be synthesized for ${PRODUCTION_REGION}; received ${this.region}.`,
      );
    }

    Tags.of(this).add("Application", "finhand");
    Tags.of(this).add("Environment", "production");
    Tags.of(this).add("ManagedBy", "aws-cdk");

    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      vpcName: "finhand-prod-vpc",
    });

    const hostSecurityGroup = new ec2.SecurityGroup(
      this,
      "HostSecurityGroup",
      {
        allowAllOutbound: false,
        description:
          "Public HTTP and HTTPS access for the FinHand production proxy",
        securityGroupName: "finhand-prod-host-sg",
        vpc,
      },
    );
    hostSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Public HTTP for certificate issuance and HTTPS redirects",
    );
    hostSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Public HTTPS for the Caddy reverse proxy",
    );
    hostSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "HTTPS for AWS APIs, image pulls, OAuth, OpenAI, and updates",
    );

    const uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `finhand-prod-uploads-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Tags.of(uploadsBucket).add("DataClassification", "financial-private");

    const webRepository = this.createApplicationRepository(
      "WebRepository",
      "finhand-prod-web-ecr",
    );
    const apiRepository = this.createApplicationRepository(
      "ApiRepository",
      "finhand-prod-api-ecr",
    );

    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description:
        "Least-privilege runtime role for the FinHand production EC2 host",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
      ],
      roleName: "finhand-prod-instance-role",
    });
    webRepository.grantPull(instanceRole);
    apiRepository.grantPull(instanceRole);
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "UploadObjectAccess",
        actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ],
        resources: [uploadsBucket.arnForObjects("*")],
      }),
    );

    const host = new ec2.Instance(this, "Host", {
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(16, {
            deleteOnTermination: true,
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
          }),
        },
      ],
      detailedMonitoring: false,
      httpEndpoint: true,
      httpPutResponseHopLimit: 2,
      httpTokens: ec2.HttpTokens.REQUIRED,
      instanceMetadataTags: false,
      instanceName: "finhand-prod-host",
      instanceType: new ec2.InstanceType("t4g.small"),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      propagateTagsToVolumeOnCreation: true,
      role: instanceRole,
      securityGroup: hostSecurityGroup,
      vpc,
      vpcSubnets: { subnets: [vpc.publicSubnets[0]] },
    });

    const databaseVolume = new ec2.Volume(this, "DatabaseVolume", {
      availabilityZone: vpc.publicSubnets[0].availabilityZone,
      encrypted: true,
      size: Size.gibibytes(20),
      volumeName: "finhand-prod-database",
      volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
    });
    databaseVolume.applyRemovalPolicy(RemovalPolicy.RETAIN);
    Tags.of(databaseVolume).add("DataClassification", "financial-private");

    new ec2.CfnVolumeAttachment(this, "DatabaseVolumeAttachment", {
      device: "/dev/sdf",
      instanceId: host.instanceId,
      volumeId: databaseVolume.volumeId,
    });

    const elasticIp = new ec2.CfnEIP(this, "ElasticIp", {
      domain: "vpc",
    });
    Tags.of(elasticIp).add("Name", "finhand-prod-eip");

    new ec2.CfnEIPAssociation(this, "ElasticIpAssociation", {
      allocationId: elasticIp.attrAllocationId,
      instanceId: host.instanceId,
    });

    new CfnOutput(this, "Architecture", {
      description: "Approved production deployment model",
      value: "single-ec2-docker-compose",
    });

    new CfnOutput(this, "VpcId", {
      description: "Production VPC ID",
      value: vpc.vpcId,
    });

    new CfnOutput(this, "PublicSubnetId", {
      description: "Public subnet ID for the production EC2 host",
      value: vpc.publicSubnets[0].subnetId,
    });

    new CfnOutput(this, "HostSecurityGroupId", {
      description: "Security group ID for the production EC2 host",
      value: hostSecurityGroup.securityGroupId,
    });

    new CfnOutput(this, "UploadsBucketName", {
      description: "Private bucket for production document and audio uploads",
      value: uploadsBucket.bucketName,
    });

    new CfnOutput(this, "WebRepositoryUri", {
      description: "ECR repository URI for the production web image",
      value: webRepository.repositoryUri,
    });

    new CfnOutput(this, "ApiRepositoryUri", {
      description: "ECR repository URI shared by the production API and worker",
      value: apiRepository.repositoryUri,
    });

    new CfnOutput(this, "InstanceRoleName", {
      description: "Least-privilege role for the production EC2 host",
      value: instanceRole.roleName,
    });

    new CfnOutput(this, "HostInstanceId", {
      description: "Production EC2 host instance ID",
      value: host.instanceId,
    });

    new CfnOutput(this, "HostPublicIp", {
      description: "Stable public IPv4 address for the production EC2 host",
      value: elasticIp.attrPublicIp,
    });

    new CfnOutput(this, "DatabaseVolumeId", {
      description: "Retained encrypted PostgreSQL data volume ID",
      value: databaseVolume.volumeId,
    });
  }

  private createApplicationRepository(
    id: string,
    repositoryName: string,
  ): ecr.Repository {
    return new ecr.Repository(this, id, {
      repositoryName,
      encryption: ecr.RepositoryEncryption.AES_256,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
