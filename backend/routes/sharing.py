from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend import models, auth, schemas
from backend.utils import emailer

router = APIRouter(prefix="/api/nodes", tags=["Node Sharing"])

@router.post("/{node_id}/share", response_model=schemas.NodeShareActionResponse)
def share_node(
    node_id: str,
    share_data: schemas.NodeShareCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Share a node with another user via email.
    If email exists -> Add directly to NodeShares.
    If email does not exist -> Create PendingInvitation and send email invite.
    """
    target_email = share_data.email.strip().lower()
    
    # Check if target email belongs to an existing registered user
    target_user = db.query(models.User).filter(models.User.email == target_email).first()

    if target_user:
        # Don't allow sharing with yourself
        if target_user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot share a node with yourself"
            )

        # Check if already shared
        existing_share = db.query(models.NodeShare).filter(
            models.NodeShare.node_id == node_id,
            models.NodeShare.shared_with_user_id == target_user.id
        ).first()

        if existing_share:
            return schemas.NodeShareActionResponse(
                status="added",
                message="User is already a member of this node",
                member=schemas.NodeMemberResponse(
                    id=existing_share.id,
                    user_id=target_user.id,
                    email=target_user.email,
                    username=target_user.username,
                    status="active",
                    access_level=existing_share.access_level,
                    created_at=existing_share.created_at
                )
            )

        # Create new NodeShare
        new_share = models.NodeShare(
            node_id=node_id,
            shared_with_user_id=target_user.id,
            access_level="user"
        )
        db.add(new_share)

        # Delete any pending invitations for this email & node
        db.query(models.PendingInvitation).filter(
            models.PendingInvitation.node_id == node_id,
            models.PendingInvitation.invited_email == target_email
        ).delete(synchronize_session=False)

        db.commit()
        db.refresh(new_share)

        return schemas.NodeShareActionResponse(
            status="added",
            message="Member added successfully!",
            member=schemas.NodeMemberResponse(
                id=new_share.id,
                user_id=target_user.id,
                email=target_user.email,
                username=target_user.username,
                status="active",
                access_level=new_share.access_level,
                created_at=new_share.created_at
            )
        )

    else:
        # User does not exist -> Create or update PendingInvitation
        existing_invite = db.query(models.PendingInvitation).filter(
            models.PendingInvitation.node_id == node_id,
            models.PendingInvitation.invited_email == target_email,
            models.PendingInvitation.status == "pending"
        ).first()

        if not existing_invite:
            existing_invite = models.PendingInvitation(
                node_id=node_id,
                invited_email=target_email,
                invited_by_user_id=current_user.id,
                status="pending"
            )
            db.add(existing_invite)
            db.commit()
            db.refresh(existing_invite)

        # Send invitation email via SMTP
        inviter_identifier = current_user.username or current_user.email
        emailer.send_invitation_email(target_email, inviter_identifier, node_id)

        return schemas.NodeShareActionResponse(
            status="invite_sent",
            message="User not found. Invitation email sent!",
            member=schemas.NodeMemberResponse(
                id=existing_invite.id,
                user_id=None,
                email=target_email,
                username="Invited User",
                status="pending",
                access_level="user",
                created_at=existing_invite.created_at
            )
        )


@router.get("/{node_id}/members", response_model=List[schemas.NodeMemberResponse])
def get_node_members(
    node_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get all shared members and pending invitations for a specific node."""
    members_list = []

    # 1. Fetch active shared users
    active_shares = db.query(models.NodeShare).filter(
        models.NodeShare.node_id == node_id
    ).all()

    for share in active_shares:
        user = share.shared_with_user
        if user:
            members_list.append(schemas.NodeMemberResponse(
                id=share.id,
                user_id=user.id,
                email=user.email,
                username=user.username,
                status="active",
                access_level=share.access_level,
                created_at=share.created_at
            ))

    # 2. Fetch pending invitations
    pending_invites = db.query(models.PendingInvitation).filter(
        models.PendingInvitation.node_id == node_id,
        models.PendingInvitation.status == "pending"
    ).all()

    for invite in pending_invites:
        members_list.append(schemas.NodeMemberResponse(
            id=invite.id,
            user_id=None,
            email=invite.invited_email,
            username="Invited User",
            status="pending",
            access_level="user",
            created_at=invite.created_at
        ))

    return members_list


@router.delete("/{node_id}/share/{member_id}")
def remove_node_member(
    node_id: str,
    member_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a shared member or cancel a pending invitation."""
    # Check if member_id matches a NodeShare (by Share ID or User ID)
    share = db.query(models.NodeShare).filter(
        models.NodeShare.node_id == node_id,
        (models.NodeShare.id == member_id) | (models.NodeShare.shared_with_user_id == member_id)
    ).first()

    if share:
        db.delete(share)
        db.commit()
        return {"message": "Member removed successfully"}

    # Check if member_id matches a PendingInvitation
    invite = db.query(models.PendingInvitation).filter(
        models.PendingInvitation.node_id == node_id,
        models.PendingInvitation.id == member_id
    ).first()

    if invite:
        db.delete(invite)
        db.commit()
        return {"message": "Invitation cancelled successfully"}

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Member or invitation not found"
    )
