from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend import models, auth, schemas

router = APIRouter(prefix="/api/homes", tags=["Homes"])

@router.post("", response_model=schemas.HomeResponse, status_code=status.HTTP_201_CREATED)
def create_home(
    home_data: schemas.HomeCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new home for the authenticated user."""
    new_home = models.Home(
        name=home_data.name,
        owner_id=current_user.id
    )
    db.add(new_home)
    db.commit()
    db.refresh(new_home)
    return new_home

@router.get("", response_model=List[schemas.HomeResponse])
def get_homes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all homes owned by the authenticated user."""
    return db.query(models.Home).filter(models.Home.owner_id == current_user.id).all()

@router.delete("/{home_id}", status_code=status.HTTP_200_OK)
def delete_home(
    home_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a home by UUID. Deletes associated rooms and devices."""
    home = db.query(models.Home).filter(
        models.Home.id == home_id,
        models.Home.owner_id == current_user.id
    ).first()
    
    if not home:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Home not found or access denied"
        )
        
    db.delete(home)
    db.commit()
    return {"detail": "Home and all linked resources successfully terminated."}

@router.post("/cleanup-test-data", status_code=status.HTTP_200_OK)
def cleanup_test_data(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete empty test homes for the authenticated user."""
    user_homes = db.query(models.Home).filter(models.Home.owner_id == current_user.id).all()
    cleaned_homes = 0

    for home in user_homes:
        rooms_count = db.query(models.Room).filter(models.Room.home_id == home.id).count()
        devs_count = db.query(models.Device).filter(models.Device.home_id == home.id).count()
        if rooms_count == 0 and devs_count == 0:
            db.delete(home)
            cleaned_homes += 1

    db.commit()
    return {
        "detail": "Test data cleanup completed successfully.",
        "cleaned_homes": cleaned_homes
    }
