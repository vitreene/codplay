/** Serializes runtime operations while allowing one failure per operation. */
export class RuntimeOperationCoordinator {
  private current: Promise<unknown> = Promise.resolve()

  /** Runs one operation after all previously submitted operations settle. */
  enqueue<Result>(operation: () => Promise<Result> | Result): Promise<Result> {
    const task = this.current.then(operation)
    this.current = task.then(() => undefined, () => undefined)
    return task
  }
}
