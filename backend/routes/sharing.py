from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend import models, auth, schemas
from backend.utils import emailer, notifier

router = APIRouter(prefix="/api/nodes", tags=["Node Sharing"])

def _get_room_name_for_node(db: Session, node_id: str) -> str:
    """Helper to resolve human-readable room name for a node ID."""
    dev = db.query(models.Device).filter(
        (models.Device.node_id == node_id) | (models.Device.node_id.like(f"{node_id}_%"))
    ).first()
    if dev and dev.room_id:
        room = db.query(models.Room).filter(models.Room.id == dev.room_id).first()
        if room:
            return room.name
    if dev and dev.name:
        return dev.name
    return f"Node ({node_id})"

@router.post("/{node_id}/share", response_model=schemas.NodeShareActionResponse)
def share_node(
    node_id: str,
    share_data: schemas.NodeShareCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Share a node with another user via email.
    Creates a PendingInvitation with status='pending' and triggers push notification.
    """
    target_email = share_data.email.strip().lower()
    
    # Check if target email belongs to an existing registered user
    target_user = db.query(models.User).filter(models.User.email == target_email).first()

    if target_user and target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot share a node with yourself"
        )

    # Check if already active in NodeShares
    if target_user:
        existing_share = db.query(models.NodeShare).filter(
            models.NodeShare.node_id == node_id,
            models.NodeShare.shared_with_user_id == target_user.id
        ).first()

        if existing_share:
            return schemas.NodeShareActionResponse(
                status="added",
                message="User is already an active member of this node",
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

    # Check if already pending invitation
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

    room_name = _get_room_name_for_node(db, node_id)
    inviter_name = current_user.username or current_user.email

    # Trigger Push Notification if target_user exists and has push token
    if target_user and target_user.expo_push_token:
        notifier.send_expo_push_notification(
            push_token=target_user.expo_push_token,
            title="New Sharing Request",
            body=f"{inviter_name} wants to share {room_name}",
            data={
                "type": "node_invite",
                "invite_id": str(existing_invite.id),
                "node_id": node_id,
                "room_name": room_name,
                "inviter_username": inviter_name
            }
        )

    # Also send email invite for non-existing or offline users
    emailer.send_invitation_email(target_email, inviter_name, node_id)

    return schemas.NodeShareActionResponse(
        status="invite_sent",
        message=f"Sharing request sent to {target_email}!",
        member=schemas.NodeMemberResponse(
            id=existing_invite.id,
            user_id=target_user.id if target_user else None,
            email=target_email,
            username=target_user.username if target_user else "Invited User",
            status="pending",
            access_level="user",
            created_at=existing_invite.created_at
        )
    )


@router.get("/pending-invites", response_model=List[schemas.PendingInviteItemResponse])
def get_pending_invites_received(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all pending node invitations received by the current user."""
    invites = db.query(models.PendingInvitation).filter(
        models.PendingInvitation.invited_email == current_user.email.strip().lower(),
        models.PendingInvitation.status == "pending"
    ).order_by(models.PendingInvitation.created_at.desc()).all()

    items = []
    for inv in invites:
        inviter = db.query(models.User).filter(models.User.id == inv.invited_by_user_id).first()
        inviter_user = inviter.username if inviter else "Smart Home Owner"
        inviter_mail = inviter.email if inviter else ""
        room_name = _get_room_name_for_node(db, inv.node_id)

        items.append(schemas.PendingInviteItemResponse(
            invite_id=inv.id,
            node_id=inv.node_id,
            room_name=room_name,
            inviter_username=inviter_user,
            inviter_email=inviter_mail,
            created_at=inv.created_at
        ))

    return items


@router.post("/invitations/{invite_id}/accept", status_code=status.HTTP_200_OK)
def accept_invitation(
    invite_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a pending node invitation."""
    invite = db.query(models.PendingInvitation).filter(
        models.PendingInvitation.id == invite_id,
        models.PendingInvitation.invited_email == current_user.email.strip().lower(),
        models.PendingInvitation.status == "pending"
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending invitation not found or already processed"
        )

    # Check if NodeShare already exists
    existing_share = db.query(models.NodeShare).filter(
        models.NodeShare.node_id == invite.node_id,
        models.NodeShare.shared_with_user_id == current_user.id
    ).first()

    if not existing_share:
        new_share = models.NodeShare(
            node_id=invite.node_id,
            shared_with_user_id=current_user.id,
            access_level="user"
        )
        db.add(new_share)

    invite.status = "accepted"
    db.commit()

    return {"message": "Invitation accepted successfully!", "node_id": invite.node_id}


@router.post("/invitations/{invite_id}/reject", status_code=status.HTTP_200_OK)
def reject_invitation(
    invite_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a pending node invitation."""
    invite = db.query(models.PendingInvitation).filter(
        models.PendingInvitation.id == invite_id,
        models.PendingInvitation.invited_email == current_user.email.strip().lower(),
        models.PendingInvitation.status == "pending"
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending invitation not found or already processed"
        )

    invite.status = "rejected"
    db.commit()

    return {"message": "Invitation rejected successfully"}


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
                username=user.username or user.email,
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
        # Check if invited email matches an existing user to show real username
        invited_user = db.query(models.User).filter(models.User.email == invite.invited_email).first()
        display_name = invited_user.username if invited_user else "Invited User"

        members_list.append(schemas.NodeMemberResponse(
            id=invite.id,
            user_id=invited_user.id if invited_user else None,
            email=invite.invited_email,
            username=display_name,
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
    share = db.query(models.NodeShare).filter(
        models.NodeShare.node_id == node_id,
        (models.NodeShare.id == member_id) | (models.NodeShare.shared_with_user_id == member_id)
    ).first()

    if share:
        db.delete(share)
        db.commit()
        return {"message": "Member removed successfully"}

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
