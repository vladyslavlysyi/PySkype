"""Sprint 1-3 Telegram Upgrade

Revision ID: 001_sprint_upgrade
Revises: 
Create Date: 2026-07-27 16:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_sprint_upgrade'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add columns to messages
    op.add_column('messages', sa.Column('is_edited', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('messages', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('messages', sa.Column('reply_to_message_id', sa.String(), nullable=True))
    
    op.create_foreign_key('fk_messages_reply_to_message_id', 'messages', 'messages', ['reply_to_message_id'], ['id'], ondelete='SET NULL')

    # Add column to conversation_participants
    op.add_column('conversation_participants', sa.Column('role', sa.String(), server_default='member', nullable=False))

    # Create message_reactions table
    op.create_table('message_reactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('emoji', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('message_id', 'user_id', 'emoji', name='_message_user_emoji_uc')
    )

    # Create pinned_messages table
    op.create_table('pinned_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('pinned_by', sa.String(), nullable=False),
        sa.Column('pinned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['pinned_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Add TSVECTOR for full-text search
    op.execute("ALTER TABLE messages ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;")
    op.execute("CREATE INDEX ix_messages_search_vector ON messages USING GIN (search_vector);")

def downgrade() -> None:
    op.execute("DROP INDEX ix_messages_search_vector;")
    op.execute("ALTER TABLE messages DROP COLUMN search_vector;")
    
    op.drop_table('pinned_messages')
    op.drop_table('message_reactions')
    
    op.drop_column('conversation_participants', 'role')
    
    op.drop_constraint('fk_messages_reply_to_message_id', 'messages', type_='foreignkey')
    op.drop_column('messages', 'reply_to_message_id')
    op.drop_column('messages', 'edited_at')
    op.drop_column('messages', 'is_edited')
