export class SecretDocument {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public key: string,
    public value: string,
    public note: string = '',
    public readonly creationDate?: Date,
    public readonly revisionDate?: Date
  ) {}


  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      projectId: this.projectId,
      key: this.key,
      value: this.value,
      note: this.note
    }, null, 2);
  }


  static fromJSON(jsonStr: string): SecretDocument {
    const data = JSON.parse(jsonStr);
    return new SecretDocument(
      data.id,
      data.projectId,
      data.key,
      data.value,
      data.note || '',
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.revisionDate ? new Date(data.revisionDate) : undefined
    );
  }


  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.key || this.key.trim().length === 0) {
      errors.push('Secret key cannot be empty');
    }
    
    if (this.key && this.key.length > 200) {
      errors.push('Secret key cannot exceed 200 characters');
    }
    
    if (this.value && this.value.length > 10000) {
      errors.push('Secret value cannot exceed 10,000 characters');
    }
    
    if (this.note && this.note.length > 10000) {
      errors.push('Secret note cannot exceed 10,000 characters');
    }
    
    return errors;
  }
}
