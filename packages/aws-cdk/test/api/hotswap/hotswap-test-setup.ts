import * as cxapi from '@aws-cdk/cx-api';
import { CloudFormation } from 'aws-sdk';
import * as lambda from 'aws-sdk/clients/lambda';
import * as stepfunctions from 'aws-sdk/clients/stepfunctions';
import { DeployStackResult } from '../../../lib';
import * as deployments from '../../../lib/api/hotswap-deployments';
import { Template } from '../../../lib/api/util/cloudformation';
import { testStack, TestStackArtifact } from '../../util';
import { MockSdkProvider } from '../../util/mock-sdk';
import { FakeCloudformationStack } from '../fake-cloudformation-stack';

const STACK_NAME = 'withouterrors';
export const STACK_ID = 'stackId';

let cfnMockProvider: CfnMockProvider;
let currentCfnStack: FakeCloudformationStack;
const currentCfnStackResources: CloudFormation.StackResourceSummary[] = [];

export function setupHotswapTests() {
  jest.resetAllMocks();
  // clear the array
  currentCfnStackResources.splice(0);
  cfnMockProvider = new CfnMockProvider();
  currentCfnStack = new FakeCloudformationStack({
    stackName: STACK_NAME,
    stackId: STACK_ID,
  });

  return cfnMockProvider;
}

export function cdkStackArtifactOf(testStackArtifact: Partial<TestStackArtifact> = {}): cxapi.CloudFormationStackArtifact {
  return testStack({
    stackName: STACK_NAME,
    ...testStackArtifact,
  });
}

export function pushStackResourceSummaries(...items: CloudFormation.StackResourceSummary[]) {
  currentCfnStackResources.push(...items);
}

export function setCurrentCfnStackTemplate(template: Template) {
  currentCfnStack.setTemplate(template);
}

export function stackSummaryOf(logicalId: string, resourceType: string, physicalResourceId: string): CloudFormation.StackResourceSummary {
  return {
    LogicalResourceId: logicalId,
    PhysicalResourceId: physicalResourceId,
    ResourceType: resourceType,
    ResourceStatus: 'CREATE_COMPLETE',
    LastUpdatedTimestamp: new Date(),
  };
}

export class CfnMockProvider {
  private mockSdkProvider: MockSdkProvider;

  constructor() {
    this.mockSdkProvider = new MockSdkProvider({ realSdk: false });

    this.mockSdkProvider.stubCloudFormation({
      listStackResources: ({ StackName: stackName }) => {
        if (stackName !== STACK_NAME) {
          throw new Error(`Expected Stack name in listStackResources() call to be: '${STACK_NAME}', but received: ${stackName}'`);
        }
        return {
          StackResourceSummaries: currentCfnStackResources,
        };
      },
    });
  }

  public setUpdateStateMachineMock(mockUpdateMachineDefinition:
  (input: stepfunctions.UpdateStateMachineInput) =>
  stepfunctions.UpdateStateMachineOutput) {
    this.mockSdkProvider.stubStepFunctions({
      updateStateMachine: mockUpdateMachineDefinition,
    });
  }

  public setUpdateFunctionCodeMock(mockUpdateLambdaCode: (input: lambda.UpdateFunctionCodeRequest) => lambda.FunctionConfiguration) {
    this.mockSdkProvider.stubLambda({
      updateFunctionCode: mockUpdateLambdaCode,
    });
  }

  public tryHotswapDeployment(
    stackArtifact: cxapi.CloudFormationStackArtifact,
    assetParams: { [key: string]: string } = {},
  ): Promise<DeployStackResult | undefined> {
    return deployments.tryHotswapDeployment(this.mockSdkProvider, assetParams, currentCfnStack, stackArtifact);
  }
}
